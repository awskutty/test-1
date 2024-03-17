/*
@Api_Name : /LockItems,
@Description: To Lock the particular transactions - Update the LOCKED_BY column
@Last_Error_code:ERR-HAN-41725
@Modified for : Check version no before lock
*/

// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var objSpRecordLock = require('../../../../torus-references/common/serviceHelper/RecordLock');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqAuditLog = require('../../../../torus-references/log/audit/AuditLog');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');

var serviceName = 'LockItems';
// Host api to server
router.post('/LockItems', function (appRequest, appResponse, next) {
  reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {


    objLogInfo.HANDLER_CODE = 'LOCK_ITEMS';

    // From redis session
    var strAppId = objSessionInfo.APP_ID;
    var strLoginName = objSessionInfo.LOGIN_NAME;
    var strUid = objSessionInfo.U_ID;

    // From appRequest
    var pHeaders = appRequest.headers;

    var strDTTCode = appRequest.body.PARAMS.DTT_CODE || '';
    var strDTCode = appRequest.body.PARAMS.DT_CODE || '';
    var strLockingMode = appRequest.body.PARAMS.LOCKING_MODE || '';
    var strPrevDTTCode = appRequest.body.PARAMS.PREV_DTT_CODE || '';
    var strPrevDTCode = appRequest.body.PARAMS.PREV_DT_CODE || '';
    var strKeyVal = appRequest.body.PARAMS.KEY_VAL || '';
    var strPrevVal = appRequest.body.PARAMS.PREV_KEY_VAL || '';
    var CurTranVersion = appRequest.body.PARAMS.VERSION_NO;
    // || 42;
    appResponse.on('close', function () {
      reqTranDBInstance.CallRollback(mTranDB);
    });
    appResponse.on('finish', function () { });
    appResponse.on('end', function () { });

    if (CurTranVersion === '' || CurTranVersion === undefined) {
      return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41733', 'Version_No not available. ', ' Version number not available in request ');
    } else {
      var mTranDB;
      var TokenId;
      try {
        reqTranDBInstance.GetTranDBConn(pHeaders, false, function (pSession) {
          mTranDB = pSession;
          reqAuditLog.GetProcessToken(mTranDB, objLogInfo, function (err, prct_id) {
            try {
              if (err) {
                return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'Error Code', 'Error in GetProcessToken()', null, "Error", err.stack);
              }
              TokenId = prct_id;
              // Do locking for the transaction
              try {
                reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
                // Calling ToggleLock Method
                ToggleLock();
                // Unlock previous transactions against the users and lock current selected transactions
                function ToggleLock() {
                  try {
                    // To pass this param value to Record lock helper file
                    objLogInfo.CurrentTrnVersion = CurTranVersion;
                    var RecordParams = {
                      strPrevVal,
                      strPrevDTCode,
                      strPrevDTTCode,
                      strKeyVal,
                      strDTCode,
                      strDTTCode,
                    };
                    if (strKeyVal != '' && strLockingMode != '' && strLockingMode != undefined) {
                      objSpRecordLock.RecordLock(strAppId, TokenId, strUid, '', 'TOGGLE_LOCK', strLockingMode, 0, reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo), '', mTranDB, strLoginName, objLogInfo, pHeaders, '', '', RecordParams,
                        function (LockRes) {
                          if (LockRes.STATUS == 'FAILURE') {
                            reqInstanceHelper.PrintInfo(serviceName, LockRes.SUCCESS_MESSAGE, objLogInfo);
                            reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, LockRes.ERROR_CODE, LockRes.ERROR_MESSAGE, LockRes.ERROR_OBJECT);
                            return;
                          } else {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, LockRes.SUCCESS_DATA, objLogInfo, null, null, null, 'SUCCESS', LockRes.SUCCESS_MESSAGE);
                            return;
                          }
                        });
                    } else {
                      reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41705', 'Locking Mode not defined or select Item id not available', '');
                      return;
                    }

                  } catch (error) {
                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41706', 'Exception occured while calling ToggleLock', error);
                    return;
                  }
                }
              } catch (error) {
                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41707', 'Exception occured on initial function calling', error);
                return;
              }

            } catch (error) {
              return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'Error Code', 'Catch Error in GetProcessToken()', null, "Error", error);
            }
          });
        });
      } catch (error) {
        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41708', 'Exception occured initially', error);
        return;
      }
    }
  });
});
module.exports = router;
/*********** End of Service **********/