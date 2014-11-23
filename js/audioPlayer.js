(function () {
    'use strict';

    var audio = null;
    var currentPlayingSongId = null;
    var volume = 0.5;

    function setVolume(vol) {
        volume = vol;
        audio.volume = vol;
    }

    function playForTrack(track_to_play) {
        if (currentPlayingSongId == track_to_play.id) {
            return;
        }

        if (currentPlayingSongId != null) {
            audio.setAttribute('src', track_to_play.preview_url);
            audio.load();
            audio.play();
        } else {
            audio = new Audio(track_to_play.preview_url);
            audio.volume = volume;
            audio.load();
            audio.play();
        }
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
