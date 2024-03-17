/****
 * Api_Name          : /Queryexecdetails,
 * Description       : ,
 * Last_Error_Code   : ERR-ANL-5100
 ****/

// Require dependencies
var modPath = '../../../../node_modules/'
var express = require(modPath + 'express');
var reqTranDBInstance = require('../../../../torus-references/instance/AnalyticInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInsHelper = require('../../../../torus-references/common/InstanceHelper');

// Initialize Global variables
var strResult = '';
var strMessage = '';

var router = express.Router();

// Host the login api
router.post('/queryexecdetails', function (appReq, appResp) {

    reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {
    reqLogWriter.Eventinsert(objLogInfo);
    objLogInfo.PROCESS = 'QUERYEDITOR_QUERY_EXECUTION_DETAILS';
    objLogInfo.ACTION = 'queryexecdetails';
    var strHeader = {};

    if (appReq.headers && appReq.headers.routingkey) {
        strHeader = appReq.headers;
        strHeader.routingkey = "CLT-0~APP-0~TNT-0~ENV-0";
    }
    else {
        strHeader = { 'routingkey': 'CLT-0~APP-0~TNT-0~ENV-0' }
    }

    var Prows = {
        project_id: appReq.body.prjct_id,
        name: appReq.body.query_name,
        query_string: appReq.body.query_string,
        data_source: appReq.body.data_source_selection,
        data_destination: appReq.body.data_destination_selection,
        execution_date_time: appReq.body.query_execution_date_time,
        execution_status: appReq.body.query_execution_status,
        execution_duration: appReq.body.query_execution_duration,
        created_by: appReq.body.created_by,
        created_date: appReq.body.created_date
    };

    try {
        // reqTranDBInstance.GetTranDBConn(strHeader, false, function callbackGetTranDB(pSession) {
        //     reqTranDBInstance.InsertTranDBWithAudit(pSession, 'project_queries', [Prows], objLogInfo, function callback(pResult, pError) {
        //         if (pError)
        //             _SendResponse({}, 'ERR-ANL-111105', 'Error while Inserting Projectquery Table', pError, null,objLogInfo);
        //         else
        //             _SendResponse('SUCCESS', '', '', null, null,objLogInfo);

        //     })
        // })
        var check_query = "select * from project_queries where name ='"+appReq.body.query_name+"';"
        reqTranDBInstance.GetTranDBConn(strHeader, false, function callbackGetTranDB(pSession) {
          reqTranDBInstance.ExecuteSQLQuery(pSession, check_query,objLogInfo, function callbackTransactionSetUpdate(pResult, pError) {
              try {
                  if (pError) {
                      _SendResponse({}, 'Errcode', 'Error in checking query existence', pError, null,objLogInfo);
                  }
                  else{
                      if (pResult.rows.length > 0) {
                        try {
                          reqTranDBInstance.UpdateTranDBWithAudit(pSession, 'project_queries', {
                            QUERY_STRING: appReq.body.query_string,
                            DATA_SOURCE: appReq.body.data_source_selection,
                            DATA_DESTINATION: appReq.body.data_destination_selection,
                            EXECUTION_DATE_TIME:appReq.body.query_execution_date_time,
                            EXECUTION_STATUS: appReq.body.query_execution_status,
                            EXECUTION_DURATION: appReq.body.query_execution_duration 
                          },{NAME: appReq.body.query_name} ,objLogInfo, function callbackTransactionSetUpdate(pRes, pError) {
                                if (pError) {
                                    _SendResponse({}, 'Errcode', 'Unable To Update Table', pError, null,objLogInfo);
                                }
                                else{
                                    _SendResponse({SUCCESS:'Querydetails Updated Successfully'}, '', '', null, null,objLogInfo);
                                }
                          })
                        } catch (error) {
                            _SendResponse({}, 'Errcode', 'Unable To Update Table', error, null,objLogInfo);
                        }
                      }
                      else {
                        try {
                          reqTranDBInstance.InsertTranDBWithAudit(pSession, 'project_queries', [Prows], objLogInfo, function callbackTransactionSetUpdate(pRes, pError) {
                                if (pError) {
                                    _SendResponse({}, 'Errcode', 'Unable To insert into Table', pError, null,objLogInfo);
                                }
                                else{
                                    _SendResponse({SUCCESS:'Inserted querydetails Successfully'}, '', '','',null,objLogInfo);
                                }
                          })
                        } catch (error) {
                            _SendResponse({}, 'Errcode', 'Unable To insert into Table', error, null,objLogInfo);
                        }
                      }
                  }

              } catch (error) {
                  _SendResponse({}, 'Errcode', 'Error in query execution', error, null,objLogInfo);
              }
      })})
    } catch (error) {
        errorHandler("ERR-ANL-111105", "Error get trandb function in sparkqueryinsert" + error)
    }
});
    // To send the app response
    function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning,pobjLogInfo) {
        var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS'
        var ResponseData = (pResponseData == null || pResponseData == undefined) ? '' : pResponseData
        return reqInsHelper.SendResponse('ChangeSearchTag', appResp, ResponseData, pobjLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning)
    }
    function errorHandler(errcode, message) {
        console.log(errcode, message);
        reqLogWriter.TraceError(objLogInfo, message, errcode);
    }
});
module.exports = router;
