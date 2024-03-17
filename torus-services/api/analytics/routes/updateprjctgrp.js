/****
 * Api_Name          : /updateprjctgrp,
 * Description       : ,
 * Last_Error_Code   : ERR-ANL-5100
 ****/

// Require dependencies
var modPath = '../../../../node_modules/';
var express = require(modPath + 'express');
var reqAnalyticInstance = require('../../../../torus-references/instance/AnalyticInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqRequest = require(modPath + 'request');
// Initialize Global variables

var strResult = '';
var strMessage = '';

var router = express.Router();

// Host the login api
router.post('/updateprjctgrp', function (appReq, appResp) {
  reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {

    reqLogWriter.Eventinsert(objLogInfo);
    objLogInfo.PROCESS = 'updateprjctgrp-Analytics';
    objLogInfo.ACTION = 'updateprjctgrp';

    var strHeader = appReq.headers;
    var params = appReq.body;
    var Group_Name = params.GROUP_NAME;
    var Program_Id = params.PROGRAM_ID;
    var sequence_numb = params.SEQ_NUM;
    var Project_Id = params.PROJECT_ID;
    var createdby = params.USER_ID;
    var createdDate = reqDateFormatter.GetCurrentDateInUTC(strHeader, objLogInfo);
    var Select_Group = "select * from program_group where group_name='" + Group_Name + "' and project_id = " + Project_Id + " and program_id='" + Program_Id + "';";
    reqAnalyticInstance.GetTranDBConn(strHeader, false, function callbackGetTranDB(pSession) {
      reqAnalyticInstance.ExecuteSQLQuery(pSession, Select_Group, objLogInfo, function callbackTransactionSetUpdate(pResult, pError) {
        try {
          if (pError) {
            _SendResponse({}, 'Errcode', 'Group Not Loaded', pError, null);
          }
          else {
            if (pResult.rows.length > 0) {
              try {
                reqAnalyticInstance.UpdateTranDBWithAudit(pSession, 'PROGRAM_GROUP', {
                  CREATED_BY: createdby,
                  CREATED_DATE: createdDate,
                  SEQUENCE_NO: sequence_numb
                }, { PROJECT_ID: Project_Id, GROUP_NAME: Group_Name, PROGRAM_ID: Program_Id }, objLogInfo, function callbackTransactionSetUpdate(pRes, pError) {
                  if (pError) {
                    _SendResponse({}, 'Errcode', 'Unable To Update Table', pError, null);
                  }
                  else {
                    _SendResponse({ SUCCESS: 'Group  Updated Successfully' }, '', '', '', null);
                  }
                });
              } catch (error) {
                _SendResponse({}, 'Errcode', 'Unable To Update Table', error, null);
              }
            }
            else {
              try {
                reqAnalyticInstance.InsertTranDBWithAudit(pSession, 'PROGRAM_GROUP', [{
                  PROJECT_ID: Project_Id,
                  PROGRAM_ID: Program_Id,
                  GROUP_NAME: Group_Name,
                  CREATED_BY: createdby,
                  CREATED_DATE: createdDate,
                  SEQUENCE_NO: sequence_numb

                }], objLogInfo, function callbackTransactionSetUpdate(pRes, pError) {
                  if (pError) {
                    _SendResponse({}, 'Errcode', 'Unable To insert into Table', pError, null);
                  }
                  else {
                    _SendResponse({ SUCCESS: 'Inserted to group Successfully' }, '', '', '', null);
                  }
                });
              } catch (error) {
                _SendResponse({}, 'Errcode', 'Unable To insert into Table', error, null);
              }
            }
          }

        } catch (error) {
          _SendResponse({}, 'Errcode', 'Unable To insert into Table', error, null);
        }
      });
      // To send the app response
      function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning) {
        var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS';
        var ResponseData = (pResponseData == null || pResponseData == undefined) ? '' : pResponseData;
        return reqInstanceHelper.SendResponse('ChangeSearchTag', appResp, ResponseData, objLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning);
      }
      function errorHandler(errcode, message) {
        console.log(errcode, message);
        reqLogWriter.TraceError(objLogInfo, message, errcode);
      }
    });
  });
});
module.exports = router;
