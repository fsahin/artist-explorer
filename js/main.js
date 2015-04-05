/* global SpotifyWebApi, dndTree, $, geoplugin_countryCode, Promise, google, setRepeatArtists */
(function () {
    'use strict';

    var numberOfArtistsToShow = 10;
    var playPopTrackTimeoutId;

    var showCompletion = true;
    var repeatArtists = false;

    //default to US
    var userCountry = "US";

    //replace with configured servers uri
    var serverBasePath = "http://localhost:10000";

    var localApi = new localProxyApi(serverBasePath);
    var spotifyWebApi = new SpotifyWebApi()

    var currentApi = localApi;

    var loadAllGenresUri = serverBasePath + "/api/genres"
    var loadArtistInfoUri = serverBasePath + "/api/artist-info/"

    function getGenreArtistsUri(genreId) {
        return serverBasePath + "/api/genres/" + genreId + "/artists";
    }

    window.onresize = function () {
        dndTree.resizeOverlay();
        var height = $(window).height();
        $('#rightpane').height(height);
    };

    $('#rightpane').height($(window).height());

    function setRepeatArtists() {
        if (document.getElementById('repeatArtists').checked) {
            repeatArtists = true;
        } else {
            repeatArtists = false;
        }
    }

    function initContainer() {
        var initArtistId = stripTrailingSlash(qs('artist_id')),
            initGenre = stripTrailingSlash(qs('genre')),
            initEntry = stripTrailingSlash(qs('tree'));

        if (initEntry) {
            $.ajax({
                url: serverBasePath + '/api/entries/' + initEntry
            }).done(function (data) {
                initRootWithData(JSON.parse(data));
            });
        }
        else if (initArtistId) {
            currentApi.getArtist(initArtistId).then(initRootWithArtist);
        } else if (initGenre) {
            initRootWithGenre(initGenre);
        } else {
            currentApi.getArtist('43ZHCT0cAZBISjO8DG9PnE').then(initRootWithArtist);
        }
    }

    window.addEventListener('load', function () {

        $.ajax({
            url: "https://freegeoip.net/json/"
        }).done(function (data) {
            userCountry = data.country_code;
        });

        initContainer();

        var formArtist = document.getElementById('search-artist');
        formArtist.addEventListener('submit', function (e) {
            showCompletion = false;
            e.preventDefault();
            var search = document.getElementById('artist-search');
            currentApi.searchArtists(
                search.value.trim(),
                userCountry
                ).then(function (data) {
                if (data.artists && data.artists.items.length) {
                    initRootWithArtist(data.artists.items[0]);
                }
            });

        }, false);


        var formGenre = document.getElementById('search-genre');
        formGenre.addEventListener('submit', function (e) {
            showCompletion = false;
            e.preventDefault();
            var search = document.getElementById('genre-search');
            var genreName = search.value.trim();
            initRootWithGenre(genreName);
        }, false);

    }, false);

    function qs(name) {
        name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
        var regex = new RegExp('[\\?&]' + name + '=([^&#]*)'),
            results = regex.exec(location.search);
        return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
    }

    function stripTrailingSlash(str) {
        if (str.substr(-1) == '/') {
            return str.substr(0, str.length - 1);
        }
        return str;
    }

    var allGenres = [];

    loadAllGenres();

    function initRootWithArtist(artist) {
        dndTree.setRoot(artist);
        $('#genre-search').val('');
    }

    function initRootWithGenre(genre) {
        dndTree.setRootGenre(genre);
        $('#artist-search').val('');
    }

    function initRootWithData(data) {
        dndTree.setRootData(data);
        $('#artist-search').val('');
        $('#genre-search').val('');
    }


    function loadAllGenres() {
        $.ajax({
            url: loadAllGenresUri
        }).done(function (data) {
            data.genres.forEach(function (genre) {
                allGenres.push(toTitleCase(genre.name));
            });
        });
    }

    function toTitleCase(str) {
        return str.replace(/\w\S*/g, function (txt) {return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
    }

    var getInfoTimeoutid;
    function getInfo(artist) {
        getInfoTimeoutid = window.setTimeout(function () {
            _getInfo(artist);
            $('#rightpane').animate({ scrollTop: '0px' });
        }, 500);
    }

    function getInfoCancel(artist) {
        window.clearTimeout(getInfoTimeoutid);
    }

    var artistInfoModel = function() {
        var self = this;

        self.artistName = ko.observable();
        self.isArtistInfoVisible = ko.observable(false);
        self.spotifyLink = ko.observable();
        self.popularity = ko.observable();
        self.biography = ko.observable();
        self.bioExists = ko.observable();
        self.genres = ko.observableArray([]);
        self.topTracks = ko.observableArray([]);

        self.switchToGenre = function() {
            initRootWithGenre(this.name);
        }

        self.playTrack = function() {
            var self2 = this;
            var track = {
                'preview_url': this.preview_url,
                'id': this.id,
            }
            playPopTrackTimeoutId = window.setTimeout(function () {
                _playTrack(track);
                ko.utils.arrayForEach(self.topTracks(), function(track) {
                    track.isPlaying(false);
                });
                self2.isPlaying(true);
            }, 500);
        }

        self.playTrackCancel = function() {
            window.clearTimeout(playPopTrackTimeoutId);
        }
    }

    function _playTrack(track) {
        Player.playForTrack(track);
    }

    var artistInfoModel = new artistInfoModel()

    ko.applyBindings(artistInfoModel, document.getElementById('rightpane'));

    function _getInfo(artist) {
        $('#hoverwarning').css('display', 'none');

        artistInfoModel.isArtistInfoVisible(true);
        artistInfoModel.artistName(artist.name);
        artistInfoModel.spotifyLink(artist.external_urls.spotify)

        drawChart(artist.popularity);

        $.ajax({
            url: loadArtistInfoUri + artist.uri
        }).done(function (data) {
            var bioFound = false;
            if (data.artist.biographies) {
                data.artist.biographies.forEach(function (biography) {
                    if (!biography.truncated && !bioFound) {
                        artistInfoModel.biography(biography.text);
                        bioFound = true;
                    }
                });
            }
            artistInfoModel.bioExists(bioFound);

            artistInfoModel.genres([]);
            data.artist.genres.forEach(function (genre) {
                artistInfoModel.genres.push(
                    {
                        'name': genre.name,
                        'titleCaseName': toTitleCase(genre.name),
                    }
                )
            });
        });

        currentApi.getArtistTopTracks(artist.id, userCountry).then(function (data) {
            Player.playForTrack(data.tracks[0]);
            artistInfoModel.topTracks([]);
            data.tracks.forEach(function (track, i) {
                artistInfoModel.topTracks.push({
                    'isPlaying': i == 0 ? ko.observable(true): ko.observable(false),
                    'id': track.id,
                    'name': track.name,
                    'preview_url': track.preview_url,
                    'spotifyLink': track.external_urls.spotify,
                });
            });
        }, function (err) {
            Player.clearMusic();
        });
    }

    function getRelated(artistId, excludeList) {
        return new Promise(function (resolve, reject) {
            return currentApi.getArtistRelatedArtists(artistId).then(function (data) {

                data.artists.sort(function (a, b) {
                    return b.popularity - a.popularity;
                });
                if (!repeatArtists) {
                    data.artists = data.artists.filter(function (artist) {
                        return excludeList.indexOf(artist.id) === -1;
                    });
                }

                resolve(data.artists.slice(0, numberOfArtistsToShow));
            });
        });
    }

    function getIdFromArtistUri(artistUri) {
        return artistUri.split(':').pop();
    }

    function getArtistsForGenre(genreName) {
        return new Promise(function (resolve, reject) {
            return $.ajax({
                url: getGenreArtistsUri(encodeURIComponent(genreName.toLowerCase()))
            }).then(function (data) {
                var idsToRequest = [];
                data.artists.forEach(function (artist) {
                    if (artist.foreign_ids) {
                        idsToRequest.push(getIdFromArtistUri(artist.foreign_ids[0].foreign_id));
                    }
                });
                return currentApi.getArtists(idsToRequest).then(function (data) {
                    //Sort in popularity order
                    resolve(data.artists.sort(function (a, b) {
                        return b.popularity - a.popularity;
                    }).slice(0, numberOfArtistsToShow));
                });
            });
        });
    }

    function changeNumberOfArtists(value) {
        numberOfArtistsToShow = value;
        document.getElementById('range-indicator').innerHTML = value;
    }

    function createAutoCompleteDiv(artist) {
        if (!artist) {
            return;
        }
        var val = '<div class="autocomplete-item">' +
            '<div class="artist-icon-container">' +
            '<img src="' + getSuitableImage(artist.images) + '" class="circular artist-icon" />' +
            '<div class="artist-label">' + artist.name + '</div>' +
            '</div>' +
            '</div>';
        return val;
    }

    var unavailCountryMessageSet = false;

    function setUnavailCountryErrorMessage() {
        var msg = 'Oops, seems like Spotify is not available in your country yet';
        if (unavailCountryMessageSet) {
            return;
        }
        var message = '<div class="alert alert-danger alert-error">' +
            msg +
            '</div>';
        $('#rightpane').prepend(message);
        unavailCountryMessageSet = true;
    }

    $(function () {
        $('#artist-search')
            // don't navigate away from the field on tab when selecting an item
            .bind('keydown', function (event) {
                showCompletion = true;
                if (event.keyCode === $.ui.keyCode.TAB &&
                    $(this).autocomplete('instance').menu.active) {
                    event.preventDefault();
                }
            })
            .autocomplete({
                minLength: 0,
                source: function (request, response) {
                    currentApi.searchArtists(request.term + '*', {'limit': 50, market: userCountry}).then(function (data) {
                        if (data.artists && data.artists.items.length) {
                            var res = [];
                            data.artists.items.forEach(function (artist) {
                                res.push(artist);
                            });
                            if (showCompletion) {
                                response(res);
                            } else {
                                response([]);
                            }
                        }
                    }, function (err) {
                        if (err.status == 400) {
                            setUnavailCountryErrorMessage();
                            return;
                        }
                    });
                },
                focus: function () {
                    // prevent value inserted on focus
                    return false;
                },
                select: function (event, ui) {
                    $('#artist-search').val(ui.item.name);
                    initRootWithArtist(ui.item);
                    return false;
                }
            })
            .autocomplete('instance')._renderItem = function (ul, item) {
                if (!item) {
                    console.log('no item');
                    return;
                }
                return $('<li></li>')
                    .data('item.autocomplete', item)
                    .append(createAutoCompleteDiv(item))
                    .appendTo(ul);
            };

        $('#genre-search')
            // don't navigate away from the field on tab when selecting an item
            .bind('keydown', function (event) {
                showCompletion = true;
                if (event.keyCode === $.ui.keyCode.TAB &&
                    $(this).autocomplete('instance').menu.active) {
                    event.preventDefault();
                }
                if (event.keyCode == 13) {
                    $('.ui-menu-item').hide();
                }
            })
            .autocomplete({
                minLength: 0,
                source: function (request, response) {
                    if (showCompletion) {
                        response($.ui.autocomplete.filter(allGenres, request.term));
                    } else {
                        response([]);
                    }
                },
                focus: function (e, ui) {
                    // prevent value inserted on focus
                    return false;
                },
                select: function (event, ui) {
                    $('#genre-search').val(ui.item.value);
                    initRootWithGenre(ui.item.value);
                    return false;
                }
            });
    });

    function drawChart(popularity) {
        var popData = google.visualization.arrayToDataTable([
             ['Popularity', popularity],
        ], true);

        var options = {
            width: 300, height: 120,
            redFrom: 80, redTo: 100,
            yellowFrom:50, yellowTo: 80,
            minorTicks: 5
        };

        var chart = new google.visualization.Gauge(document.getElementById('chart_div'));
        chart.draw(popData, options);
    }

    function getSuitableImage(images) {
        var minSize = 64;
        if (images.length === 0) {
            return 'img/spotify.jpeg';
        }
        images.forEach(function (image) {
            if (image && image.width > minSize && image.width > 64) {
                return image.url;
            }
        });

        return images[images.length - 1].url;
    }

    function saveTree() {
        $.post(serverBasePath + '/api/savetree',
        {
            entry_data: JSON.stringify(dndTree.getRoot())
        }).done(function (data) {
            //console.log(data);
        });
    }

    var currentLink;

    function share() {
        $.post(serverBasePath + '/api/savetree',
        {
            entry_data: JSON.stringify(dndTree.getRoot())
        }).done(function (entry_id) {
            currentLink = "https://artistexplorer.spotify.com?tree=" + entry_id;
            shareModel.link(currentLink);
            $('#myModal').modal('show');
        });
    }

    function fbShare() {
        FB.ui({
          method: 'share',
          href: currentLink,
          caption: 'Look at the relationship tree I just created',
        }, function(response){});
    }

    var shareModel = function() {
        var self = this;
        self.link = ko.observable();
    }

    var shareModel = new shareModel()
    ko.applyBindings(shareModel, document.getElementById('myModal'));

    //todo:make it work
    function copyLink() {
        text = $('#shareLink').text();
    }

    var loginModel = function() {
        var self = this;
        var localAccessToken = getAccessTokenLocal();
        if (localAccessToken && localAccessToken !== '') {
            self.isLoggedIn = ko.observable(true);
            self.userId = ko.observable(localStorage.getItem('ae_userid',''));
            self.displayName = ko.observable(localStorage.getItem('ae_display_name',''));
            self.userImage = ko.observable(localStorage.getItem('ae_user_image',''));
            spotifyWebApi.setAccessToken(localStorage.getItem('ae_token',''));
        } else {
            self.isLoggedIn = ko.observable(false);
            self.userId = ko.observable();
            self.displayName = ko.observable();
            self.userImage = ko.observable();

        }

    }

    var loginModel = new loginModel();

    function getAccessTokenLocal() {
        var expires = 0 + localStorage.getItem('ae_expires', '0');
        if ((new Date()).getTime() > expires) {
            return '';
        }
        return localStorage.getItem('ae_token', '');
    }

    ko.applyBindings(loginModel, document.getElementById('navbar-collapse-1'));


    var errorBoxModel = function() {
        var self = this;
        self.errorMessage = ko.observable();
    }

    var errorBoxModel = new errorBoxModel();
    ko.applyBindings(errorBoxModel, document.getElementById('error-modal'));


    function login() {
        OAuthManager.obtainToken({
          scopes: [
              'playlist-read-private',
              'playlist-modify-public',
              'playlist-modify-private'
            ]
          }).then(function(token) {
            onTokenReceived(token);
          }).catch(function(error) {
            console.error(error);
          });
    }

    function getDisplayName(str) {
        var maxDisplayLength = 11;
        if (str.length < maxDisplayLength) {
            return str;
        }

        var spaceIndex = str.indexOf(' ');
        if (spaceIndex != -1 && spaceIndex < maxDisplayLength) {
            return str.substr(0, spaceIndex);
        }
        return str.substr(0, maxDisplayLength);
    }

    function onTokenReceived(accessToken) {
        loginModel.isLoggedIn(true);
        spotifyWebApi.setAccessToken(accessToken);
        localStorage.setItem('ae_token', accessToken);
        localStorage.setItem('ae_expires', (new Date()).getTime() + 3600 * 1000); // 1 hour
        spotifyWebApi.getMe().then(function(data){
            loginModel.userId(data.id);
            loginModel.displayName(getDisplayName(data.display_name));
            loginModel.userImage(data.images[0].url);
            localStorage.setItem('ae_userid', data.id);
            localStorage.setItem('ae_display_name', data.display_name);
            localStorage.setItem('ae_user_image', data.images[0].url);
        });
        currentApi = spotifyWebApi;
    }

    function createPlaylistFromTrackIds(trackIds) {
        spotifyWebApi.createPlaylist(loginModel.userId(), {
                'name': $('#text-playlist-name').val(),
                'public': true
        },
        function(error, playlist) {
            var uris = [];
            trackIds.forEach(function(trackId) {
                uris.push("spotify:track:" + trackId);
            });
            spotifyWebApi.addTracksToPlaylist(loginModel.userId(), playlist.id, uris, {}, function(err, d) {
                $('#text-playlist-name').val("");
                $('#createPlaylistModal').modal('hide');
                $('#playlistCreatedModal').modal('show');
            });
        });
    }

    function createPlaylistModal() {
        if (!loginModel.isLoggedIn()) {
            errorBoxModel.errorMessage("Please log in first");
            $('#error-modal').modal('show');
        } else {
            $('#createPlaylistModal').modal('show');
        }

    }

    function createPlaylist() {
        var playlistName = $('#text-playlist-name').val();
        if (!playlistName) {
            $('#playlist-name-form-group').addClass('has-error');
            return;
        } else {
            $('#playlist-name-form-group').removeClass('has-error');
        }
        var artistIds = dndTree.getAllArtists();

        var promises = []
        artistIds.forEach(function(artistId){
            var promise= currentApi.getArtistTopTracks(artistId, userCountry);
            promises.push(promise);
        });

        Promise.all(promises).then(function(data) {
            var trackIds = [];
            data.forEach(function(topTracks) {
                topTracks.tracks.forEach(function(track) {
                    trackIds.push(track.id);
                });
            });

            var numOfItems;
            try {
                numOfItems = getTrackLength(trackIds.length);
            } catch(err) {
                $('#createPlaylistModal').modal('hide');
                errorBoxModel.errorMessage("Not enough tracks to create playlists");
                $('#error-modal').modal('show');
                return;
            }

            trackIds = Util.getRandom(trackIds, numOfItems);
            createPlaylistFromTrackIds(trackIds);

        }, function() {
          console.log("Something failed");
        });
    }

    function getTrackLength(numOfTotalTracks) {
        if (numOfTotalTracks >= 50) {
            return 50;
        } else if (numOfTotalTracks < 1) {
            throw new RangeError("Not enough tracks");
        }
        return numOfTotalTracks;
    }

    function logout() {
        loginModel.isLoggedIn(false);
        loginModel.userId("");
        loginModel.displayName("");
        loginModel.userImage("");
        localStorage.clear();
        currentApi = localApi;
    }

    window.AE = {
        getSuitableImage: getSuitableImage,
        getRelated: getRelated,
        getArtistsForGenre: getArtistsForGenre,
        getInfoCancel: getInfoCancel,
        getInfo: getInfo,
        changeNumberOfArtists: changeNumberOfArtists,
        setRepeatArtists: setRepeatArtists,
        toTitleCase: toTitleCase,
        artistInfoModel: artistInfoModel,
        saveTree: saveTree,
        share: share,
        copyLink: copyLink,
        fbShare: fbShare,
        login: login,
        createPlaylistModal: createPlaylistModal,
        createPlaylist: createPlaylist,
        logout: logout
    };
})();
