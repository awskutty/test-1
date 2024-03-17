/****
 * Api_Name          : /Upload,
 * Description       : ,
 * Last_Error_Code   : ERR-ANL-5100
 ****/

// Require dependencies
var modPath = '../../../../node_modules/'
var express = require(modPath + 'express');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var request = require(modPath +'request');
var redisInstance= require('../../../../torus-references/instance/RedisInstance.js');

// Initialize Global variables

var strResult = '';
var strMessage = '';

var router = express.Router();

// Host the login api
router.post('/metabaseintegration', function(appReq, appResp) {

    var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(appReq.body, appReq);
    reqLogWriter.Eventinsert(objLogInfo);
    objLogInfo.PROCESS = 'metabaseintegration-Analytics';
    objLogInfo.ACTION = 'metabaseintegration';
    
    try {
       var options={};

        redisInstance.GetRedisConnection(function (error, clientR) {
            if(error){
           
            }
            else{
                clientR.get("METABASE-INTEGRATION-KEY",function(err,result){
                    if(err){
                  
                    }
                    else{
                        options=JSON.parse(result);
                        options.json.username=appReq.body.torususeremailid;
                        console.log(options);
                        request(options, function (error, response, body) {
                            if (!error && response.statusCode == 200) {
                                // Print out the response body
                    
                                console.log(body)
                                appResp.send(body);
                            }
                            else{
                                 console.log(body)
                            }
                        })
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