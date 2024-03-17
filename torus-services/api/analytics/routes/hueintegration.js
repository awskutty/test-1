/****
 * Api_Name          : /Upload,
 * Description       : ,
 * Last_Error_Code   : ERR-ANL-5100
 ****/

// Require dependencies
var modPath = '../../../../node_modules/'
var express = require(modPath + 'express');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var redisInstance = require('../../../../torus-references/instance/RedisInstance.js');

// Initialize Global variables

var strResult = '';
var strMessage = '';

var router = express.Router();

// Host the login api
router.post('/hueintegration', function (appReq, appResp) {

    var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(appReq.body, appReq);
    reqLogWriter.Eventinsert(objLogInfo);
    objLogInfo.PROCESS = 'hueintegration-Analytics';
    objLogInfo.ACTION = 'hueintegration';

    try {
        var options = {};

        redisInstance.GetRedisConnection(function (error, clientR) {
            if (error) {

            }
            else {
                clientR.get("HUE-INTEGRATION-KEY", function (err, result) {
                    if (err) {
                        appResp.send(err);
                    }
                    else {
                        options = JSON.parse(result);
                        appResp.send(JSON.stringify({ "status": options.PASSWORD }));

                    }
                })


            }

        })




    } catch (error) {
        errorHandler("ERR-FX-10021", "Error APLogin function ERR-001 " + error)
    }

    function errorHandler(errcode, message) {
        console.log(errcode, message);
        reqLogWriter.TraceError(objLogInfo, message, errcode);
    }
});
module.exports = router;