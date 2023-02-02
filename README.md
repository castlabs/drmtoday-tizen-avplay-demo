# Tizen AVPlay DRMToday integration

This repository contains an example of how your application can play protected media content using the AVPlay API and DRMtoday.

To learn more about the AVPlay API see:

- https://developer.samsung.com/smarttv/develop/api-references/samsung-product-api-references/avplay-api.html
- https://developer.samsung.com/smarttv/develop/guides/multimedia/media-playback/using-avplay.html

---

### IMPORTANT NOTES:

For playback of protected content on Tizen 2.3 TVs use only PlayReady since those TVs support only Widevine Classic which is deprecated.

For Tizen 2.4, 3.0 and 4.0 Widevine initialization is different than for Tizen 5.0 and later versions (shown below in code example).

DRMToday can deliver Widevine license in two modes: first is inside a JSON response (with extra data) and second is with `specConform` option that returns only the license.

---

## Simple playback

To play clear content create an element in the html file:

```html
<div id="player"></div>
```

and append the AVPlay object to the element:

```js
var avplay = document.createElement('object');
avplay.setAttribute('type', 'application/avplayer');
avplay.setAttribute(
  'style',
  'width:100%; height:100%; position: absolute; top:0; left:0;z-index:420;pointer-events:none;'
);
document.getElementById('player').appendChild(avplay);
```

Define the event handlers using the `setListener()` method:

```js
var listener = {
  onbufferingstart: function () {
    console.log('Buffering start.');
  },

  onbufferingprogress: function (percent) {
    console.log('Buffering progress data : ' + percent);
  },

  onbufferingcomplete: function () {
    console.log('Buffering complete.');
  },
  onstreamcompleted: function () {
    console.log('Stream Completed');
    webapis.avplay.stop();
  },

  oncurrentplaytime: function (currentTime) {
    console.log('Current playtime: ' + currentTime);
  },

  onerror: function (eventType) {
    console.log('event type error : ' + eventType);
  },

  onevent: function (eventType, eventData) {
    console.log('event type: ' + eventType + ', data: ' + eventData);
  },

  onsubtitlechange: function (duration, text, data3, data4) {
    console.log('subtitleText: ' + text);
  },
  ondrmevent: function (drmEvent, drmData) {
    console.log('DRM callback: ' + drmEvent + ', data: ' + drmData);
  },
};

webapis.avplay.setListener(listener);
```

Then pass the content url to the API, prepare the content and call `play()` to start playback:

```js
var successCallback = function () {
  console.log('The media has finished preparing');
  webapis.avplay.play();
};

var errorCallback = function () {
  console.log('The media has failed to prepare');
};

webapis.avplay.open('Content URL');
webapis.avplay.setDisplayRect(0, 0, 1920, 1080);
webapis.avplay.prepareAsync(successCallback, errorCallback);
```

## PlayReady integration

This method is driven by the AVPlay creation of challenge data and acquiring license data directly from the license server and performing install.
If license server requires additional properties for acquiring license data (e.g. HTTP header, User agent, Cookie, etc.), application should call `setDrm("PLAYREADY", "SetProperties", properties)` method with setting additional data inside json object as in the example code below.
To execute this case, either set the value for `GetChallenge` to `false` or do not set `GetChallenge` property for `SetProperties` drmOperation in setDrm() AVPlay API.

```js
var properties = JSON.stringify({
  DeleteLicenseAfterUse: false,
  GetChallenge: false,
  LicenseServer: content.playreadyServerUrl,
  CustomData: content.customData,
});

function initPlayreadyDRM() {
  try {
    console.log('Using PlayReady!!');
    webapis.avplay.setDrm(
      'PLAYREADY',
      'SetProperties',
      properties
    );
  } catch (e) {
    console.log('Error during PlayReady init:', e);
    throw e;
  }
}

...

webapis.avplay.open("Content URL");
webapis.avplay.setListener(listener);
initPlayreadyDRM();
webapis.avplay.setDisplayRect(0, 0, 1920, 1080);
webapis.avplay.prepareAsync(successCallback, errorCallback);
```

## Widevine integration

To play Widevine protected content, unlike PlayReady, the application should acquire `license data` as challenge data to the license server and install using `setDrm("WIDEVINE_CDM", "widevine_license_data", license_data)`

When sending a request, the application should set the license server information (`content.widevineServerUrl`). And if necessary, the application can set the extra information (`content.customData`).

Note: If using `specConfrom=true` inside the widevineServerUrl which will return only the license instead of parsing the `responseStr` (like shown in the example code bellow), all that needs to be done is to base64 encode it and pass it to the `webapis.avplay.setDrm('WIDEVINE_CDM', 'widevine_license_data', licenseParam);`


<table>
<tr>
<th>Without specConform</th>
<th>With specConform</th>
</tr>
<tr>
<td>

```js
var responseStr = responseList.join('');
var responseJson = JSON.parse(responseStr);
var licenseParam =
  data.session_id +
  'PARAM_START_POSITION' +
  responseJson.license +
  'PARAM_START_POSITION';
webapis.avplay.setDrm('WIDEVINE_CDM', 
  'widevine_license_data', licenseParam);
```
</td>
<td>

```js
var responseStr = responseList.join('');
var licenseParam =
  data.session_id +
  'PARAM_START_POSITION' +
  btoa(responseStr) +
  'PARAM_START_POSITION';
webapis.avplay.setDrm('WIDEVINE_CDM', 
  'widevine_license_data', licenseParam);
```
</td>
</tr>
</table>

```js
function widevineLicenseRequest(event, data) {

  if (data.name === 'Challenge') {
    var message = atob(data.challenge);
    var messageBuffer = new Uint8Array(message.length);
    for (var i = 0; i < message.length; ++i) {
      messageBuffer[i] = message.charCodeAt(i);
    }

    var xmlhttp = new XMLHttpRequest();
    xmlhttp.responseType = 'arraybuffer';

    xmlhttp.open('POST', content.widevineServerUrl, true);
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
          var responseJson = JSON.parse(responseStr);
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

...

function initWidevineDRM(properties) {
  if (isTizen(3) || isTizen(4)) {
    // Before Tizen version 5.0
    webapis.avplay.setDrm('WIDEVINE_CDM', 'Initialize', '');
    webapis.avplay.setDrm(
      'WIDEVINE_CDM',
      'widevine_app_session',
      properties.AppSession
    );
    webapis.avplay.setDrm(
      'WIDEVINE_CDM',
      'widevine_data_type',
      properties.DataType
    );
  } else {
    // Since Tizen version 5.0
    webapis.avplay.setDrm(
      'WIDEVINE_CDM',
      'SetProperties',
      JSON.stringify(properties)
    );
  }
}

...

var properties = {
  AppSession: String(Math.floor(Math.random() * Math.floor(10000))),
  DataType: 'MPEG-DASH',
}

webapi.avplay.open("Content URL");
webapi.avplay.setListen({ondrmevent:widevineLicenseRequest});
initWidevineDRM(properties)
webapis.avplay.setDisplayRect(0, 0, 1920, 1080);
webapis.avplay.prepareAsync(successCallback, errorCallback);
```
