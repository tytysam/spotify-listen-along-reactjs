const express = require("express");
const querystring = require("querystring");
const request = require("request");

const Router = express.Router;
const AppConfig = require("./config/app.js");
const AuthConfig = require("./config/authorization.js");

// HOST is currently set to localhost:3000
const redirect_uri = `${AppConfig.HOST}/auth/callback`;
const client_id = AuthConfig.CLIENT_ID;
const client_secret = AuthConfig.CLIENT_SECRET;

let auth = Router();

/*
 * Generates a random string containing numbers and letters
 * @param  {length} The length of the string
 * @return {text} The generated string
 */
const generateRandomString = (length) => {
  let text = "";
  let possibleText =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (let i = 0; i < length; i++) {
    text += possibleText.charAt(
      Math.floor(Math.random() * possibleText.length)
    );
  }
  return text;
};

const stateKey = "spotify_auth_state";

auth.get("/login", (req, res) => {
  let state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  let scope = "user-read-playback-state user-modify-playback-state";
  res.redirect(
    "https://accounts.spotify.com/authorize?" +
      querystring.stringify({
        response_type: "code",
        client_id: client_id,
        scope: scope,
        redirect_uri: redirect_uri,
        state: state,
      })
  );
});

auth.get("/callback", (req, res) => {
  // your application should request refresh and access tokens after checking the state parameter

  let code = req.query.code || null;
  let state = req.query.state || null;
  let storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    console.log(
      "state mismatch",
      "state: " + state,
      "storedState " + storedState,
      "cookies " + req.cookies
    );
    res.render("views/callback", {
      access_token: null,
      expires_in: null,
    });
  } else {
    res.clearCookie(stateKey);
    let authOptions = {
      url: "https:accounts.spotify.com/api/token",
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: "authorization code",
      },
      headers: {
        Authorization:
          "Basic " +
          new Buffer.from(client_id + ":" + client_secret).toString("base64"),
      },
      json: true,
    };

    request.post(authOptions, (error, response, body) => {
      if (!error && response.statusCode === 200) {
        let access_token = body.access_token,
          refresh_token = body.refresh_token,
          expires_in = body.expires_in;

        res.cookie("refresh_token", refresh_token, {
          // refresh token attached to cookie should last ~ 1 month
          maxAge: 30 * 24 * 3600 * 1000,
        });

        res.render("views/callback", {
          access_token: access_token,
          expires_in: expires_in,
          refresh_token: refresh_token,
        });
      } else {
        res.render("views/callback", {
          access_token: null,
          expires_in: null,
        });
      }
    });
  }
});

auth.post("/token", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  let refreshToken = req.body ? req.body.refresh_token : null;
  if (refreshToken) {
    let authOptions = {
      url: "https://accounts.spotify.com/api/token",
      form: {
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      },
      headers: {
        Authorization:
          "Basic " +
          new Buffer.from(client_id + ":" + client_secret).toString("base64"),
      },
      json: true,
    };
    request.post(authOptions, (error, response, body) => {
      if (!error && response.statusCode === 200) {
        let access_token = body.access_token,
          expires_in = body.expires_in;

        res.setHeader("Content-Type", "application/json");
        res.send(
          JSON.stringify({
            access_token: access_token,
            expires_in: expires_in,
          })
        );
      } else {
        res.setHeader("Content-Type", "application/json");
        res.send(JSON.stringify({ access_token: "", expires_in: "" }));
      }
    });
  } else {
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify({ access_token: "", expires_in: "" }));
  }
});

module.exports = authorization;