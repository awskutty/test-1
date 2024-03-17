/*
@Api_Name : /LockItems,
@Description: To Un-Lock the particular transactions (Update the LOCKED_BY column),
@Last_Error_Code:ERR-HAN-41812
*/

// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var objSpRecordUnLock = require('../../../../torus-references/common/serviceHelper/RecordUnLock');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var serviceName = 'UnLockItems';
var reqAuditLog = require('../../../../torus-references/log/audit/AuditLog');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');

// Host the api to server
router.post('/UnLockItems', function (appRequest, appResponse, next) {
  var objLogInfo;
  var mTranDB;
  var TokenId;
  // Close event handling when client closes the api request
  appResponse.on('close', function () {
    reqTranDBInstance.CallRollback(mTranDB);
  });
  appResponse.on('finish', function () { });
  appResponse.on('end', function () { });

  reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
    reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);

    objLogInfo.HANDLER_CODE = 'UNLOCK_ITEMS';

    var pHeaders = appRequest.headers;

    reqTranDBInstance.GetTranDBConn(pHeaders, false, function (pSession) {
      mTranDB = pSession;
      reqFXDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function CallbackGetCassandraConn(pClient) {
        var mDepcas = pClient;
        var params = appRequest.body.PARAMS;

        // From session
        var strAppId = (objSessionInfo.APP_ID == undefined && objSessionInfo.APP_ID == null) ? params.APP_ID : objSessionInfo.APP_ID;
        var strUid = (objSessionInfo.USER_ID == undefined && objSessionInfo.USER_ID == null) ? params.U_ID : objSessionInfo.USER_ID;
        var strLoginName = (objSessionInfo.USER_NAME == undefined && objSessionInfo.USER_NAME == null) ? params.LOGIN_NAME : objSessionInfo.USER_NAME;

        var strLockingMode = params.LOCKING_MODE;
        reqInstanceHelper.PrintInfo(serviceName, 'Calling RecordUnlock helper', objLogInfo);
        reqInstanceHelper.PrintInfo(serviceName, 'Record Unlock Called', objLogInfo);
        reqAuditLog.GetProcessToken(mTranDB, objLogInfo, function (err, prct_id) {
          try {
            if (err) {
              return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'Error Code', 'Error in GetProcessToken()', null, "Error", err.stack);
            }
            TokenId = prct_id;
            objSpRecordUnLock.RecordUnLock(strAppId, strUid, '', TokenId, '', strLockingMode, reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo), mTranDB, strLoginName, objLogInfo, mDepcas, {}, function callbackUnlock(UnLockRes) {
              if (UnLockRes.STATUS === 'SUCCESS') {
                reqInstanceHelper.PrintInfo(serviceName, 'Records unlocked Successfully', objLogInfo);
                reqInstanceHelper.SendResponse(serviceName, appResponse, UnLockRes.SUCCESS_DATA, objLogInfo, null, null, null, "SUCCESS", UnLockRes.SUCCESS_MESSAGE);
              } else {
                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, UnLockRes.ERROR_CODE, UnLockRes.ERROR_MESSAGE, UnLockRes.ERROR_OBJECT);
              }
            });
          } catch (error) {
            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'Error Code', 'Catch Error in GetProcessToken()', null, "Error", err.stack);
          }
        });
      });
    });
  });
});
module.exports = router;
  /*********** End of Service **********/