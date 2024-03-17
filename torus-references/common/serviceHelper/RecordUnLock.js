/**
@Description: Unlock previously locked records - Set locked by columns to null
**/

// Require dependencies
var reqTranDBInstance = require('../../instance/TranDBInstance');
var reqFXDBInstance = require('../../instance/DBInstance');
var reqInstanceHelper = require('../../common/InstanceHelper');

var serviceName = 'UnLockItems';
// var objLogInfo = null

// query initilization
var QUERY_RECORD_UNLOCK_PROCESS = "UPDATE <tran_db>.TRANSACTION_SET TS SET LOCKED_BY = ?, MODIFIED_BY= ? , MODIFIED_BY_STS_ID=?, MODIFIED_DATE = ? , MODIFIED_BY_NAME=?,LOCKED_BY_NAME=?  WHERE COALESCE(TS.LOCKED_BY,'') = '' AND TS.TS_ID IN (SELECT DISTINCT TS_ID FROM TMP_FINAL_ITEMS)";

var mClient;
var mTranDB;
// var objLogInfo
// Variable declaration
var pAppId, TokenId, UID, STS_ID, TS_ID, LockingMode, LockingType, LockingCount, CurrentTime, LockQuery, casInst, pLoginName = '';

// UnLock the records
function unlockRecord(pAppId, UID, STS_ID, PRCT_ID, LockingMode, LockingType, CurrentTime, pTranDB, pLoginName, pLogInfo, mDepcas, RecordUnlock, callbackUnLockRecord) {
  var objLogInfo = pLogInfo;
  var resObj = {};
  reqInstanceHelper.PrintInfo(serviceName, 'Method Unlock Record called', objLogInfo);
  try {


    if (LockingMode == 'PROCESS_LOCK') {
      reqInstanceHelper.PrintInfo(serviceName, 'Locking Mode is Process Lock', objLogInfo);
      var QUERY_RECORD_UnLOCK_PROCESS = "UPDATE <tran_db>.TRANSACTION_SET SET LOCKED_BY = NULL ,LOCKED_BY_NAME = NULL  WHERE LOCKED_BY = @UID AND TS_ID IN (SELECT TS_ID FROM TMP_FINAL_ITEMS WHERE PRCT_ID ='" + PRCT_ID + "')";
      QUERY_RECORD_UnLOCK_PROCESS = QUERY_RECORD_UnLOCK_PROCESS.replace(/@UID/g, "'" + UID + "'");
      QUERY_RECORD_UnLOCK_PROCESS = QUERY_RECORD_UnLOCK_PROCESS.replace(/@STS_ID/g, "'" + STS_ID + "'");
      QUERY_RECORD_UnLOCK_PROCESS = QUERY_RECORD_UnLOCK_PROCESS.replace(/@CURRENT_DATE/g, "'" + new Date() + "'");
      QUERY_RECORD_UnLOCK_PROCESS = QUERY_RECORD_UnLOCK_PROCESS.replace(/@LOGIN_NAME/g, "'" + pLoginName + "'");
      reqInstanceHelper.PrintInfo(serviceName, 'Executing Transaction Set for Lockign Mode Process Lock QUERY IS ' + QUERY_RECORD_UnLOCK_PROCESS, objLogInfo);
      reqTranDBInstance.ExecuteSQLQuery(pTranDB, QUERY_RECORD_UnLOCK_PROCESS, objLogInfo, function callback(pRes, pErr) {
        try {
          if (pErr) {
            resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-41807', 'Exception occured while executing PROCESS_LOCK', pErr);
            callbackUnLockRecord(resObj);
          } else {
            resObj = sendMethodResponse('SUCCESS', 'Unlock process completed for PROCESS_LOCK', pRes, '', '', '');
            callbackUnLockRecord(resObj);
          }
        } catch (error) {
          resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-41808', 'Exception occured while executing PROCESS_LOCK', error);
          callbackUnLockRecord(resObj);
        }
      });
    } else {

      reqInstanceHelper.PrintInfo(serviceName, 'Getting information from TMP_TRAN_LOCK', objLogInfo);
      try {
        if (LockingMode == 'TOGGLE_LOCK') {
          TS_ID = RecordUnlock.strPrevVal || '';
          DT_CODE = RecordUnlock.strPrevDTCode || '';
          DTT_CODE = RecordUnlock.strPrevDTTCode || '';
          // select DT_INFO table to get the TARGET_TABLE and TargetColumn
          var DTINFOSEL = "select * from DT_INFO where app_id='" + pAppId + "'and dt_code='" + DT_CODE + "'";
          reqInstanceHelper.PrintInfo(serviceName, 'Getting information from DT_INFO for dt_code ' + DT_CODE, objLogInfo);
          reqFXDBInstance.ExecuteQuery(mDepcas, DTINFOSEL, objLogInfo,
            function callbackDTINFOSEL(err, pResult) {
              try {
                if (err) {
                  resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-41802', 'Error while querying DT_INFO', err);
                  callbackUnLockRecord(resObj);
                } else {
                  var DTINFO = pResult;
                  if (DTINFO.rows.length > 0 && DTINFO.rows[0].relation_json != '' && JSON.parse(DTINFO.rows[0].relation_json).length > 0) {
                    var Rjson = [];
                    Rjson = JSON.parse(DTINFO.rows[0].relation_json);
                    Dttcatagory = Rjson[0].CATEGORY;
                    TargetTable = Rjson[0].TARGET_TABLE;
                    TargetColumn = Rjson[0].PRIMARY_COLUMN;
                  } else {
                    Dttcatagory = 'T';
                    TargetColumn = '';
                    TargetTable = '';
                  }
                  reqInstanceHelper.PrintInfo(serviceName, 'DttCategory is ' + Dttcatagory, objLogInfo);
                  if (Dttcatagory == 'M') {

                    const UnlockTargetTable = 'UPDATE' + TargetTable + 'SET LOCKED_BY=NULL, LOCKED_BY_NAME = NULL';
                    reqInstanceHelper.PrintInfo(serviceName, 'Executing query to unlock table ' + TargetTable, objLogInfo);
                    _ExecuteTranQuery(pTranDB, UnlockTargetTable, objLogInfo, function (UnlockTargetRes) {
                      if (UnlockTargetRes != '') {
                        resObj = sendMethodResponse('SUCCESS', 'Unlock process completed successfully', UnlockTargetRes, '', '', '');
                        callbackUnLockRecord(resObj);
                      }
                    });
                  }
                  reqInstanceHelper.PrintInfo(serviceName, 'Locking Type is ' + LockingType, objLogInfo);
                  if (LockingType == 'SINGLE_SELECT') {
                    const UnlockTSTable = "UPDATE <tran_db>.TRANSACTION_SET TS SET LOCKED_BY = NULL,LOCKED_BY_NAME=NULL where TS_ID='" + TS_ID + "' AND LOCKED_BY ='" + UID + "'";
                    reqInstanceHelper.PrintInfo(serviceName, 'Updating Transaction Set for Locking Type SINGLE_SELECT', objLogInfo);
                    _ExecuteTranQuery(pTranDB, UnlockTSTable, objLogInfo, function (UnlockRes) {
                      if (UnlockRes != '') {
                        resObj = sendMethodResponse('SUCCESS', 'Unlock process completed successfully', UnlockRes, '', '', '');
                        callbackUnLockRecord(resObj);
                      } else {
                        resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-41803', 'Error while updating TRANSACTION_SET', {});
                        callbackUnLockRecord(resObj);
                      }
                    });
                  } else if (LockingType == 'HIERARCHICAL_SELECT') {
                    //const UnlockQuery = ('WITH RECURSIVE RECUR_SELECT (TS_ID,PARENT_TS_ID) AS ' + '(SELECT TS_ID,PARENT_TS_ID FROM TRANSACTION_SET WHERE TS_ID IN ({0}) ' + 'UNION ALL SELECT TS.TS_ID,TS.PARENT_TS_ID ' + 'FROM  RECUR_SELECT RS, TRANSACTION_SET TS WHERE RS.TS_ID=TS.PARENT_TS_ID) ' + " UPDATE TRANSACTION_SET SET LOCKED_BY =NULL, LOCKED_BY_NAME = NULL, MODIFIED_BY ='$UID', MODIFIED_BY_STS_ID='$STS_ID', MODIFIED_DATE = '$CURRENT_DATE' , MODIFIED_BY_NAME='$LOGIN_NAME'" + " WHERE LOCKED_BY = '$UID' AND TS_ID IN (SELECT TS_ID FROM RECUR_SELECT )", TS_ID);
                    const UnlockQuery = "UPDATE <tran_db>.TRANSACTION_SET TS SET LOCKED_BY = NULL,LOCKED_BY_NAME=NULL where  LOCKED_BY ='" + UID + "'";
                    // UnlockQuery = UnlockQuery.replace(/@UID/g, "'" + UID + "'");
                    // UnlockQuery = UnlockQuery.replacereplace(/@STS_ID/g, "'" + STS_ID + "'");
                    // UnlockQuery = UnlockQuery.replacereplace(/@CURRENT_DATE/g, "'" + new Date() + "'");
                    // UnlockQuery = UnlockQuery.replacereplace(/@LOGIN_NAME/g, "'" + pLoginName + "'");
                    // UnlockQuery = UnlockQuery.replacereplace(/@TS_ID/g, "'" + TS_ID + "'");
                    reqInstanceHelper.PrintInfo(serviceName, 'Executing query for LockingType HIERARCHICAL_SELECT', objLogInfo);
                    _ExecuteTranQuery(pTranDB, UnlockQuery, objLogInfo, function (UnlockRes) {
                      if (UnlockRes != '') {
                        resObj = sendMethodResponse('SUCCESS', 'Unlock process completed successfully', UnlockRes, '', '', '');
                        callbackUnLockRecord(resObj);
                      } else {
                        resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-41804', 'Error while unlocking data', {});
                        callbackUnLockRecord(resObj);
                      }
                    });
                  } else {
                    resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-41805', 'Locktype is empty. It should be either SINGLE/HIERARCHICAL', {});
                    callbackUnLockRecord(resObj);
                  }
                }
              } catch (error) {
                resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-41806', 'Exception occured after executing select query on DT_INFO', error);
                callbackUnLockRecord(resObj);
              }
            });
        } else {
          const TSSelect = "select * from <tran_db>.TRANSACTION_SET where LOCKED_BY='" + UID + "'";
          reqInstanceHelper.PrintInfo(serviceName, 'Getting information from TRANSACTION SET', objLogInfo);
          _ExecuteTranQuery(pTranDB, TSSelect, objLogInfo, function (TSRes) {
            try {
              if (TSRes.rows.length > 0) {
                const UnlockQuery = "UPDATE <tran_db>.TRANSACTION_SET SET LOCKED_BY = NULL,LOCKED_BY_NAME=NULL WHERE LOCKED_BY='" + UID + "'";
                reqInstanceHelper.PrintInfo(serviceName, 'Updating TRANSACTION_SET', objLogInfo);
                _ExecuteTranQuery(pTranDB, UnlockQuery, objLogInfo, function (UnlockRes) {
                  // if (UnlockRes && (UnlockRes.rowCount || UnlockRes.rows.length)) {
                  // if (UnlockRes != '' && UnlockRes.rowCount > 0) {
                  resObj = sendMethodResponse('SUCCESS', 'Transaction Set Updated Successfully', '', '', '', '');
                  callbackUnLockRecord(resObj);
                  // } else {
                  //   resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-41809', 'Transaction Set Updation Failed', '');
                  //   callbackUnLockRecord(resObj);
                  // }
                });
              } else {
                resObj = sendMethodResponse('SUCCESS', 'No Items to Unlock', '', '', '', '');
                callbackUnLockRecord(resObj);
              }
            } catch (error) {
              resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-41810', 'Exception occured after executing TRANSACTION_SET select call', error);
              callbackUnLockRecord(resObj);
            }
          });
        }
      } catch (error) {
        resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-41811', 'Exception occured after executing select query onm temp process items', error);
        callbackUnLockRecord(resObj);
      }
    }

    // Execute query in transaction DB
    function _ExecuteTranQuery(tranDB, query, logInfo, callbackExec) {
      reqTranDBInstance.ExecuteSQLQuery(tranDB, query, logInfo, function callback(resp) {
        callbackExec(resp);
      });
    }
  } catch (error) {
    resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-41812', 'Exception occured at init', error);
    callbackUnLockRecord(resObj);
  }
}

// Send Response to main file
function sendMethodResponse(status, successMessage, SuccessDataObj, errorCode, errorMessage, errorObject) {
  var obj = {
    'STATUS': status,
    'SUCCESS_MESSAGE': successMessage,
    'SUCCESS_DATA': SuccessDataObj,
    'ERROR_CODE': errorCode,
    'ERROR_MESSAGE': errorMessage,
    'ERROR_OBJECT': errorObject
  };
  return obj;
}

module.exports = {
  RecordUnLock: unlockRecord
};
/*********** End of File **********/