(function () {
    'use strict';

    var volume = 0.5;
    var audio = new Audio();
    audio.volume = volume;

    var currentPlayingSongId = null;

    function setVolume(vol) {
        volume = vol;
        audio.volume = vol;
    }

    function playForTrack(track_to_play) {
        if (currentPlayingSongId == track_to_play.id) {
            return;
        }

        audio.setAttribute('src', track_to_play.preview_url);
        audio.load();
        audio.play();

        currentPlayingSongId = track_to_play.id;
    }

    function clearMusic() {
        if (audio) {
            audio.pause();
        }
        currentPlayingSongId = null;
    }

    window.Player = {
        setVolume: setVolume,
        clearMusic: clearMusic,
        playForTrack: playForTrack,
    };
})();
