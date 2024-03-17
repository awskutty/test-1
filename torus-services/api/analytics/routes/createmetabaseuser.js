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
var reqInstanceHelper =require('../../../../torus-references/common/InstanceHelper');

// Initialize Global variables

var strResult = '';
var strMessage = '';

var router = express.Router();

// Host the login api
router.post('/createmetabaseuser', function(appReq, appResp) {

    reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {
        reqLogWriter.Eventinsert(objLogInfo);
        objLogInfo.PROCESS = 'createmetabaseuser-Analytics';
        objLogInfo.ACTION = 'createmetabaseuser';
        var strHeader = {};
    
        
            strHeader = { 'routingkey': 'METABASE' }
        

            var query = "select * from core_user where is_superuser="+true+";"
            
                try {
                    reqTranDBInstance.GetTranDBConn(strHeader, false, function callbackGetTranDB(pSession) {
                      reqTranDBInstance.ExecuteSQLQuery(pSession, query, objLogInfo, function callback(res, err) {
                        if (err) {
                            _SendResponse({}, 'ERR-ANL-111105', 'Error selecting from project_queries Table', err, null,objLogInfo);
                        }
                        else {
                            console.log(JSON.stringify(res.rows));

                          try {
                           
                            appResp.setHeader('Content-Type', 'application/json');
                            // Initialize local variables
                            var params = appReq.body.PARAMS;
                            var email = params.EMAIL_ID;
                            var first_name = params.FIRST_NAME;
                            var last_name = params.LAST_NAME;
                            var password = res.rows[0].password;
                            var password_salt = res.rows[0].password_salt;
                            var date_joined = res.rows[0].date_joined;
                            var last_login = res.rows[0].last_login;
                            var is_superuser = false;
                
                
                
                            reqTranDBInstance.GetTranDBConn(strHeader, false, function callbackGetTranDB(pSession) {
                                reqTranDBInstance.InsertTranDBWithAudit(pSession, 'core_user', [{
                                    email: email,
                                    first_name: first_name,
                                    last_name: last_name,
                                    password: password,
                                    password_salt: password_salt,
                                    date_joined: date_joined,
                                    last_login: last_login,
                                    is_superuser: is_superuser,
                                    is_active: true,
                                    is_qbnewb: true,
                                    google_auth: false,
                                    ldap_auth:false
                                }], objLogInfo, function callbackTransactionSetUpdate(pResult, pError) {
                                    if (pError){
                                      console.log(pError)
                                        _SendResponse({}, 'Errcode', 'Error while update Programs Table', pError, null);
                                    }
                                       
                                    else{
                                        _SendResponse(pResult, '', '', null, null);
                                    }
                                      
                
                                })
                            })
                
              
                        } catch (error) {
                            errorHandler("ERR-FX-10021", "Error APLogin function ERR-001 " + error)
                        }





                        }
                      })
                    })
                  } catch (error) {
                    errorHandler("ERR-ANL-111105", "Error in getting trandb function in datasourceconfig" + error)
                  }





    

  
        });
      // To send the app response
      function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning,pobjLogInfo) {
        var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS'
        var ResponseData = (pResponseData == null || pResponseData == undefined) ? '' : pResponseData
        return reqInstanceHelper.SendResponse('ChangeSearchTag', appResp, ResponseData, pobjLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning)
      }
    
      function errorHandler(errcode, message) {
        console.log(errcode, message);
        reqLogWriter.TraceError(objLogInfo, message, errcode);
      }
    });

module.exports = router;