var OAuthConfig = (function() {
  'use strict';

  var clientId = '8518e2422fc946ea8ca1b2c2df5da8f9';
  var redirectUri;
  if (location.host === 'localhost:8000') {
    redirectUri = 'http://localhost:8000/callback.html';
  } else {
    redirectUri = 'https://artistexplorer.spotify.com/callback.html';
  }
  var host = /http[s]?:\/\/[^/]+/.exec(redirectUri)[0];
  return {
    clientId: clientId,
    redirectUri: redirectUri,
    host: host
  };
})();