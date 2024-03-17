var reqExpress = require('express');
var router = reqExpress.Router();
var request = require('request');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
router.post('/reCAPTCHAValidation', function (appRequest, appResponse) {
    var serviceName = 'GetCaptcha';
    var secretKey = appRequest.body.PARAMS.secretKey;
    if (appRequest.body.PARAMS['g-recaptcha-response'] === undefined || appRequest.body.PARAMS['g-recaptcha-response'] === '' || appRequest.body.PARAMS['g-recaptcha-response'] === null) {
        var respon ={ "responseCode": 1, "responseDesc": "Please select captcha" };
        reqInstanceHelper.SendResponse(serviceName, appResponse, respon, '', '', '', '', '', '');
    }
    // Put your secret key here.
    // var secretKey = "6LdLCy0UAAAAAM5VTxEZhEJQtg-X5ttBCyBGq-SY";
    var verificationUrl = "https://www.google.com/recaptcha/api/siteverify?secret=" + secretKey + "&response=" + appRequest.body.PARAMS['g-recaptcha-response'] + "&remoteip=" + appRequest.connection.remoteAddress;
    request(verificationUrl, function (error, response, body) {
        body = JSON.parse(body);
        // Success will be true or false depending upon captcha validation.
        if (body.success !== undefined && !body.success) {
            var respon = { "responseCode": 1, "responseDesc": body['error-codes'][0] };
            reqInstanceHelper.SendResponse(serviceName, appResponse, respon, '', '', '', '', '', '');
        }
        var respon = { "responseCode": 0, "responseDesc": "SUCCESS" };
        reqInstanceHelper.SendResponse(serviceName, appResponse, respon, '', '', '', '', '', '');
    });
})
module.exports = router;
//*******End of Serive*******//