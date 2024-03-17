/*
@Api_Name           : /GetAppInfo,
@Description        : To get application information from app_info
@Last_Error_code    : ERR-ENCRYPT-0002
@Last_Error_code    : ERR-DECRYPT-0002
*/

// Require dependencies
var node_modules = '../../../../node_modules/'
var referenceRoot = '../../../../torus-references'
var reqExpress = require(node_modules + 'express')
var router = reqExpress.Router()
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqEncryptionInstance = require('../../../../torus-references/common/crypto/EncryptionInstance');

// Global Variables

var serviceName = 'GetAppInfo';

// Host the GetAppInfo api
router.post('/Encrypt', function callbackDoLogout(appRequest, appResponse) {
    try {
        var objLogInfo = "";
        var responseData = {};
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {

            objLogInfo.HANDLER_CODE = 'ENCRYPT';
            objLogInfo.PROCESS = 'Encrypt-Authentication';
            objLogInfo.ACTION = 'Encrypt';

            // Handle the close event when client closes the api request
            appResponse.on('close', function () { });
            appResponse.on('finish', function () { });
            appResponse.on('end', function () { });

            var params = appRequest.body.PARAMS;
            var givenPassword = params.INPUT_STRING;
            reqInstanceHelper.PrintInfo(serviceName, 'Encrypt Begin', objLogInfo);
            // reqInstanceHelper.PrintInfo(serviceName, 'Given Password - ' + givenPassword, objLogInfo);
            reqInstanceHelper.PrintInfo(serviceName, 'Going to encrypt the given value', objLogInfo);

            if (givenPassword) {
                var encryptedPassword = reqEncryptionInstance.DoEncrypt(givenPassword);
                //reqInstanceHelper.PrintInfo(serviceName, 'Encrypted Password - ' + encryptedPassword, objLogInfo);
                responseData = { ENCRYPTED_STRING: encryptedPassword };
                reqInstanceHelper.SendResponse(serviceName, appResponse, responseData, objLogInfo, null, null, null, '', '');
                responseData = {};
                encryptedPassword = '';
            } else {
                var errMsg = 'There is no data for the encrypt process';
                reqInstanceHelper.PrintInfo(serviceName, errMsg, objLogInfo);
                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-ENCRYPT-0002', errMsg, '', "", "");
            }
        });
    } catch (error) {
        var errMsg = "Catch error while decrypting the given value..." + error.stack;
        reqInstanceHelper.PrintInfo(serviceName, errMsg, objLogInfo);
        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-ENCRYPT-0001', errMsg, error, "", "");
    }
});


router.post('/Decrypt', function callbackDoLogout(appRequest, appResponse) {
    try {
        var objLogInfo = "";
        var responseData = {};
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            objLogInfo.HANDLER_CODE = 'DECRYPT';
            objLogInfo.PROCESS = 'Decrypt-Authentication';
            objLogInfo.ACTION = 'Decrypt';

            // Handle the close event when client closes the api request
            appResponse.on('close', function () { });
            appResponse.on('finish', function () { });
            appResponse.on('end', function () { });

            var params = appRequest.body.PARAMS;
            var givenPassword = params.INPUT_STRING;
            reqInstanceHelper.PrintInfo(serviceName, 'Decrypt Begin', objLogInfo);
            //reqInstanceHelper.PrintInfo(serviceName, 'Given Password - ' + givenPassword, objLogInfo);
            reqInstanceHelper.PrintInfo(serviceName, 'Going to decrypt the given value', objLogInfo);

            if (givenPassword) {
                var depcryptedPassword = reqEncryptionInstance.DoDecrypt(givenPassword.toLowerCase());
                //reqInstanceHelper.PrintInfo(serviceName, 'Decrypted Password - ' + depcryptedPassword, objLogInfo);
                responseData = { DECRYPTED_STRING: depcryptedPassword };
                reqInstanceHelper.SendResponse(serviceName, appResponse, responseData, objLogInfo, null, null, null, '', '');
                responseData = {};
                depcryptedPassword = '';
            } else {
                var errMsg = 'There is no data for the decrypt process';
                reqInstanceHelper.PrintInfo(serviceName, errMsg, objLogInfo);
                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-DECRYPT-0002', errMsg, '', "", "");
            }
        });
    } catch (error) {
        var errMsg = "Catch Error while decrypting the given password..." + error.stack;
        reqInstanceHelper.PrintInfo(serviceName, errMsg, objLogInfo);
        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-DECRYPT-0001', errMsg, error, "", "");
    }
});

module.exports = router;
/*********** End of Service **********/