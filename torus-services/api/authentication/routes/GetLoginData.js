var reqExpress = require('express');
var router = reqExpress.Router();
var reqEncryptionInstance = require('../../../../torus-references/common/crypto/EncryptionInstance');

router.post('/GetLoginData', function (appRequest, appResponse) {
    try {
        var params = appRequest.body.PARAMS;
        var encryptedBody = params.data.split(' ').join('+');
        var decrypt = reqEncryptionInstance.DecryptPassword(encryptedBody);
        var data = {
            loginData: decrypt
        }

        appResponse.send(data)
    } catch (error) {
        var data = {
            loginData: 'FAILURE'
        }
        appResponse.send(data);
    }
});

module.exports = router;