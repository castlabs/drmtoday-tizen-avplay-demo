var avplay = document.createElement('object');
avplay.setAttribute('type', 'application/avplayer');
avplay.setAttribute(
  'style',
  'width:100%; height:100%; position: absolute; top:0; left:0;z-index:420;pointer-events:none;'
);
document.getElementById('player').appendChild(avplay);

var content = {
  src: 'https://demo.cf.castlabs.com/media/QA/QA_BBB/Manifest_WV_PR.mpd',
  playreadyUrl:
    'https://lic.staging.drmtoday.com/license-proxy-headerauth/drmtoday/RightsManager.asmx',
  widevineUrl: 'https://lic.staging.drmtoday.com/license-proxy-widevine/cenc/',
  // with specConform=true DRMToday returns same response as widevine proxy server (only license is returned)
  widevineSpecConformUrl:
    'https://lic.staging.drmtoday.com/license-proxy-widevine/cenc/?specConform=true',
  // custom data should be base64 encoded
  customData: btoa(
    JSON.stringify({
      userId: 'purchase',
      sessionId: 'default',
      merchant: 'six',
    })
  ),
  WIDEVINE: true,
  SPECCONFORM: true,
};

function initPlayreadyDRM() {
  try {
    console.log('Using PlayReady!!');
    webapis.avplay.setDrm(
      'PLAYREADY',
      'SetProperties',
      JSON.stringify({
        DeleteLicenseAfterUse: false,
        GetChallenge: false,
        LicenseServer: content.playreadyUrl,
        CustomData: content.customData,
      })
    );
  } catch (e) {
    console.log('Error during Playready init:', e);
    throw e;
  }
}

function initWidevineDRM(DrmParam) {
  if (isTizen(3) || isTizen(4)) {
    // Before Tizen version 5.0
    console.log('Using Widevine');
    webapis.avplay.setDrm('WIDEVINE_CDM', 'Initialize', '');
    webapis.avplay.setDrm(
      'WIDEVINE_CDM',
      'widevine_app_session',
      DrmParam.AppSession
    );
    webapis.avplay.setDrm(
      'WIDEVINE_CDM',
      'widevine_data_type',
      DrmParam.DataType
    );
  } else {
    // Since Tizen version 5.0
    console.log('Using Widevine');
    webapis.avplay.setDrm(
      'WIDEVINE_CDM',
      'SetProperties',
      JSON.stringify(DrmParam)
    );
  }
}

var widevineLicenseRequest = function (drmEvent, data) {
  var url = content.SPECCONFORM
    ? content.widevineSpecConformUrl
    : content.widevineUrl;

  if (data.name === 'Challenge') {
    var message = atob(data.challenge);
    var messageBuffer = new Uint8Array(message.length);
    for (var i = 0; i < message.length; ++i) {
      messageBuffer[i] = message.charCodeAt(i);
    }

    var xmlhttp = new XMLHttpRequest();
    xmlhttp.responseType = 'arraybuffer';

    xmlhttp.open('POST', url, true);
    xmlhttp.setRequestHeader('dt-custom-data', content.customData);

    xmlhttp.onload = function () {
      console.log('DRM request status: ' + this.status);

      if (this.status === 200 && this.response) {
        try {
          var responseBytes = new Uint8Array(this.response);
          var responseLen = responseBytes.byteLength;
          var responseList = [];

          for (var i = 0; i < responseLen; i++) {
            responseList.push(String.fromCharCode(responseBytes[i]));
          }

          var responseStr = responseList.join('');
          var responseJson = content.SPECCONFORM
            ? { license: btoa(responseStr) }
            : JSON.parse(responseStr);
          var licenseParam =
            data.session_id +
            'PARAM_START_POSITION' +
            responseJson.license +
            'PARAM_START_POSITION';
          webapis.avplay.setDrm(
            'WIDEVINE_CDM',
            'widevine_license_data',
            licenseParam
          );
        } catch (error) {
          console.log('DRM license parsing error: ' + error);
        }
      }
    };
    xmlhttp.send(messageBuffer);
  } else if (data.name === 'DrmError') {
    console.log('DrmError');
  }
}

function userAgentContains_(key) {
  var userAgent = window.navigator.userAgent || '';
  return userAgent.indexOf(key);
}

function isTizen(version) {
  var str = 'Tizen' + (version ? ' ' + String(version) : '');
  return userAgentContains_(str) === -1 ? false : true;
}

var listener = {
  onbufferingstart: function () {
    console.log('Buffering start.');
  },
  onbufferingprogress: function (percent) {
    // console.log('Buffering progress data: ' + percent + '%');
  },
  onbufferingcomplete: function () {
    console.log('Buffering complete.');
  },
  oncurrentplaytime: function (currentTime) {
    console.log('Current Playtime: ' + currentTime);
  },
  onevent: function (eventType, eventData) {
    console.log('Event type: ' + eventType + ', data: ' + eventData);
  },
  ondrmevent: widevineLicenseRequest,
  onerror: function (eventType) {
    console.log('Error: ' + eventType);
  },
};

try {
  webapis.avplay.open(content.src);

  webapis.avplay.setDisplayRect(0, 0, 1920, 1080);
  webapis.avplay.setListener(listener);

  try {
    var DrmParam = {};
    DrmParam.AppSession = String(Math.floor(Math.random() * Math.floor(10000)));
    DrmParam.DataType = 'MPEG-DASH';

    if (content.WIDEVINE && !isTizen(2)) {
      initWidevineDRM(DrmParam);
    } else initPlayreadyDRM();

    webapis.avplay.prepareAsync(
      function () {
        try {
          webapis.avplay.play();
        } catch (e) {
          console.log('Error while starting playback: ' + e);
        }
      },
      function (e) {
        console.log('Playback preparation failed: ' + e);
      }
    );
  } catch (e) {
    console.log('Error starting the playback: ' + e);
  }
} catch (e) {
  console.log('Error during opening the content: ' + e);
}
