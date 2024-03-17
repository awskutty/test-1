/****
 * Api_Name          : /Upload,
 * Description       : ,
 * Last_Error_Code   : ERR-ANL-5100
 ****/

// Require dependencies
var modPath = '../../../../node_modules/'
var express = require(modPath + 'express');
var reqTranDBInstance = require('../../../../torus-references/instance/AnalyticInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var redisInstance= require('../../../../torus-references/instance/RedisInstance.js');
var reqInstanceHelper =require('../../../../torus-references/common/InstanceHelper')

// Initialize Global variables

var strResult = '';
var strMessage = '';

var router = express.Router();
var strHeader = {};

// Host the login api
router.post('/rdbmskeys', function(appReq, appResp) {
    if(appReq.headers && appReq.headers.routingkey){
        strHeader = appReq.headers;
        }
        else{
        strHeader={'routingkey':'CLT-0~APP-0~TNT-0~ENV-0'}
        }
    

        reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {
            reqLogWriter.Eventinsert(objLogInfo);
            objLogInfo.PROCESS = 'rdbmskeys-Analytics';
            objLogInfo.ACTION = 'rdbmskeys';
            
            try {
                redisInstance.GetRedisConnection(function (error, clientR) {
                    if(error){
                        _SendResponse({},'Errcode','Error while update Programs Table',pError,null );
                    }
                    else{
                 clientR.keys('*', function (err, keys) {
                if (err)
                {_SendResponse({},'Errcode','Error while update Programs Table',err,null );
                }
                else{
                    rdbmskeys=[];
                     for(var i = 0, len = keys.length; i < len; i++) {
                         if(keys[i].slice(0, 6)=="rdbms_"){
                  console.log(keys[i]);
                  rdbmskeys.push(keys[i]);
                         }
                }
                _SendResponse(rdbmskeys,'','',null,null );
                }
            
            
              });
                    }
                    })
            } catch (error) {
                errorHandler("ERR-FX-10021", "Error APLogin function ERR-001 " + error)
            }
        
            function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning) {
                var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS'
                var ResponseData = (pResponseData == null || pResponseData == undefined) ? '' : pResponseData
                return reqInstanceHelper.SendResponse('ChangeSearchTag', appResp, ResponseData, objLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning)
                }
                function errorHandler(errcode, message) {
                console.log(errcode, message);
                reqLogWriter.TraceError(objLogInfo, message, errcode);
                }
        });
        
        
        })
   
module.exports = router;