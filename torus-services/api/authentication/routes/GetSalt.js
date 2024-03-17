var reqExpress = require('express');
var router = reqExpress.Router();
var reqLoginPageHelper = require('./helper/LoginPageHelper');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
router.post('/Preparesalt', function (appRequest, appResponse) {
    try {
        reqLoginPageHelper.PrepareSlat('Preparesalt', '', function (error, Res) {
            if (Res) {
                reqInstanceHelper.SendResponse('Preparesalt', appResponse, Res, '', '', '', '', 'SUCCESS', '')
            } else {
                appResponse.send(error)
                reqInstanceHelper.SendResponse('Preparesalt', appResponse, '', '', 'ERR-AUTH-SALT_001', 'Error Occured', error, 'FAILIURE', '')
            }
        })
    } catch (error) {
        console.log(error);
    }
})
module.exports = router;