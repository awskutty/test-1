/*
@Api_Name           : /GetClientId,
@Description        : To get the client id from redis,
@Last_Error_Code    : ERR-AUT-10609
*/


// Require dependencies
var reqExpress = require('express');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqRedisInstance = require('../../../../torus-references/instance/RedisInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var router = reqExpress.Router();
router.post('/GetClientID', function callbackDoLogout(appRequest, appResponse) {
    try {
        var serviceName = 'GetClientID';
        appResponse.on('close', function () { });
        appResponse.on('finish', function () { });
        appResponse.on('end', function () { });

        reqRedisInstance.GetRedisConnection(async function (error, clientR) {
            try {
                var Info = await clientR.get('CP_CLIENT_ID')
                // clientR.get('CP_CLIENT_ID', function (err, Info) {
                // if (err) {
                //     reqInstanceHelper.SendResponse(serviceName, appResponse, '', '', '', 'Exception occured inside R connection ', err, 'FAILURE');
                // } else if (Info) {
                var cltId = JSON.parse(Info).CLT;
                reqInstanceHelper.SendResponse(serviceName, appResponse, cltId, '', '', '', '', 'SUCCESS');
                // } else {
                //     reqInstanceHelper.SendResponse(serviceName, appResponse, '', '', '', 'CP_CLIENT_ID key not available in redis', '', 'FAILURE');
                // }
                // });
            } catch (error) {
                reqInstanceHelper.SendResponse(serviceName, appResponse, '', '', '', 'Exception occured inside R connection ', error, 'FAILURE');
            }
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(serviceName, appResponse, '', '', '', 'Exception occured', error, 'FAILURE');
    }
});

module.exports = router;
//*******End of Serive*******//