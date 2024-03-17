/*
@Description:Helper file for Record Lock
@Modified for : Check version no before lock/handling archival schema based on db mode
*/

// Require dependencies
var reqDateFormat = require('dateformat');
var reqDBInstance = require('../../instance/DBInstance');
var reqTranDBInstance = require('../../instance/TranDBInstance');
var objSpRecordUnLock = require('./RecordUnLock');
var reqInstanceHelper = require('../../common/InstanceHelper');
var reqCommon = require('../../transaction/Common');
var NodeTtl = require("node-ttl");
var LockTSTTL = new NodeTtl();
var LockCounterTSTTL = new NodeTtl();


// To lock the particular transactions - Updated Locked_By audit columns
function LockRecord(pAppId, TokenId, UID, STS_ID, LockingMode, LockingType, LockingCount, CurrentTime, LockQuery, pTranDB, pLoginName, objLogInfo, pHeaders, mRecordPerPage, mCurrentPageNo, RecordParams, callbackLockRecord) {

  var DT_CODE, DTT_CODE, TS_ID = '';
  var objLogInfo;
  var LockCount = '';
  var serviceName = 'RecordLock-Helper';
  var Dttcatagory = 'T';
  var TargetColumn = '';
  var TargetTable = '';


  var resObj = {};
  reqInstanceHelper.PrintInfo(serviceName, 'LockRecord initiated', objLogInfo);
  reqDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
    casInst = '';
    var mDepcas = pClient;

    // 'Mode is Toggle Lock
    if (LockingMode === 'TOGGLE_LOCK') {

      if (RecordParams.strPrevVal != '') {
        // UnLock function calling 
        reqInstanceHelper.PrintInfo(serviceName, 'Called RecordUnlock from Toggle Lock', objLogInfo);
        objSpRecordUnLock.RecordUnLock(pAppId, UID, STS_ID, TokenId, LockingMode, LockingType, CurrentTime, pTranDB, pLoginName, objLogInfo, mDepcas, RecordParams, function (Unlock) {
          if (Unlock.STATUS == 'SUCCESS') {
            reqInstanceHelper.PrintInfo(serviceName, Unlock.SUCCESS_MESSAGE, objLogInfo);
            transetLock();
          } else {
            reqInstanceHelper.PrintInfo(serviceName, Unlock.ERROR_MESSAGE, objLogInfo);
          }
        });
      } else {
        transetLock();
      }

      function transetLock() {
        try {
          if (RecordParams.strDTCode != '')
            DT_CODE = RecordParams.strDTCode;
          else
            DT_CODE = '';
          if (RecordParams.strDTTCode != '')
            DTT_CODE = RecordParams.strDTTCode;
          else
            DTT_CODE = '';
          if (RecordParams.strKeyVal != '')
            TS_ID = RecordParams.strKeyVal;
          else
            TS_ID = '';

          var DTInfoquery = "select * from DT_INFO where app_id ='" + pAppId + "' and dt_code = '" + DT_CODE + "'";
          reqInstanceHelper.PrintInfo(serviceName, 'Getting DT_INFO for particulat dt_code', objLogInfo);
          reqDBInstance.ExecuteQuery(mDepcas, DTInfoquery, objLogInfo, function callbackDTInfoquery(err, pResult) {
            try {
              if (err) {
                resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-41709', 'Query Execution Failed while fetching DT_INFO', err);
                callbackLockRecord(resObj);
              } else {
                var DTINFO = pResult;
                if (DTINFO.rows.length > 0 && DTINFO.rows[0].relation_json != '' && JSON.parse(DTINFO.rows[0].relation_json).length > 0) {
                  var Rjson = [];
                  Rjson = JSON.parse(DTINFO.rows[0].relation_json);

                  var dtinfo = [];

                  //  Get current DTT releation object
                  reqCommon.DoFilterRecursiveArr(Rjson, DTT_CODE, 'DTT_CODE', 'CHILD_DTT_RELEATIONS', objLogInfo, function (dttR) {
                    dtinfo.push(dttR);
                  });

                  if (!dtinfo.length) {
                    resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-41795', 'DT info not available', err);
                    return callbackLockRecord(resObj);
                  }
                  Dttcatagory = dtinfo[0].CATEGORY;
                  TargetTable = dtinfo[0].TARGET_TABLE;
                  TargetColumn = dtinfo[0].PRIMARY_COLUMN;
                } else {
                  Dttcatagory = 'T';
                  TargetColumn = '';
                  TargetTable = '';
                }
                reqInstanceHelper.PrintInfo(serviceName, 'DTT Category is ' + Dttcatagory, objLogInfo);
                if (Dttcatagory == 'T') {
                  try {
                    reqInstanceHelper.PrintInfo(serviceName, 'Locking Type is ' + LockingType, objLogInfo);
                    if (LockingType == 'SINGLE_SELECT') {
                      GetTransactionset(pTranDB, TS_ID, objLogInfo).then(function (tranRow) {
                        try {
                          if (tranRow.length && tranRow[0].locked_by && tranRow[0].locked_by != UID) {
                            resObj = sendMethodResponse('FAILURE', '', null, '', JSON.stringify(tranRow[0]), '');
                            return callbackLockRecord(resObj);
                          }
                          var timeout = 0;
                          const TSUpdate = "UPDATE <tran_db>.TRANSACTION_SET SET LOCKED_BY='" + UID + "', LOCKED_BY_NAME='" + pLoginName.toUpperCase() + "' WHERE TS_ID IN (SELECT TS_ID FROM <tran_db>.TRANSACTION_SET TS INNER JOIN <tran_db>." + TargetTable + " T ON TS.TRN_ID = T." + TargetColumn + " WHERE TS.TS_ID = " + TS_ID + " AND ( TS.LOCKED_BY IS NULL OR COALESCE(TS.LOCKED_BY, '') = '') AND T.VERSION_NO = " + objLogInfo.CurrentTrnVersion + ")";

                          LockTSTTL.push(TS_ID, new Date().getTime(), null, 2);
                          LockCounterTSTTL.push(TS_ID, LockCounterTSTTL.get(TS_ID) + 1, null, 2);
                          timeout = LockCounterTSTTL.get(TS_ID) - 1;
                          console.log(' timeout ----->' + timeout);

                          setTimeout(() => {
                            reqTranDBInstance.ExecuteSQLQuery(pTranDB, TSUpdate, objLogInfo, function (res, Err) {
                              try {
                                if (Err) {
                                  resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-41735', 'Transaction Set Lock Failed', Err);
                                  callbackLockRecord(resObj);
                                } else {
                                  var Condobj = {};
                                  Condobj.TS_ID = TS_ID;
                                  // Condobj.LOCKED_BY = UID;
                                  var TranSetSelQry = `select * from <tran_db>.TRANSACTION_SET where TS_ID='${TS_ID}'`;
                                  reqTranDBInstance.ExecuteSQLQuery(pTranDB, TranSetSelQry, objLogInfo, function (SelRes, err) {
                                    // reqTranDBInstance.GetTableFromTranDB(pTranDB, 'TRANSACTION_SET', Condobj, objLogInfo, function (Res, err) {
                                    if (err) {
                                      resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-41732', 'After lock query Transaction Set failed ', err);
                                      callbackLockRecord(resObj);
                                    } else {
                                      var Res = SelRes.rows
                                      if (Res.length) {
                                        if (Res[0].locked_by != '' && Res[0].locked_by != UID) {
                                          resObj = sendMethodResponse('FAILURE', '', null, '', JSON.stringify(Res[0]), '');
                                          callbackLockRecord(resObj);
                                        } else if (Res[0].locked_by != '' && Res[0].locked_by == UID) {
                                          // SUCCESS Case
                                          resObj = sendMethodResponse('SUCCESS', '', JSON.stringify(Res[0]), '', '', '');
                                          callbackLockRecord(resObj);
                                        } else {
                                          Res[0].locked_by = '-';
                                          resObj = sendMethodResponse('FAILURE', '', null, '', JSON.stringify(Res[0]), '');
                                          callbackLockRecord(resObj);
                                        }
                                      } else {
                                        resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-41733', 'Transaction Set Lock Failed. ', 'No record found.');
                                        callbackLockRecord(resObj);
                                      }
                                    }
                                  });
                                }
                              } catch (error) {
                                resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-41731', 'Transaction Set Lock Failed', error);
                                callbackLockRecord(resObj);
                              }
                            });
                          }, timeout * 500);

                        } catch (error) {
                          resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-41731', 'Transaction Set Lock Failed', error);
                          callbackLockRecord(resObj);
                        }
                      });
                    } else if (LockingType == 'HIERARCHICAL_SELECT') {
                      try {
                        var strChkQry = '';
                        if (pTranDB.DBConn.DBType == 'oracledb') {
                          strChkQry = '(WITH  RECUR(TS_ID,PARENT_TS_ID) AS (' + "SELECT TS_ID,PARENT_TS_ID FROM <tran_db>.TRANSACTION_SET TS WHERE TS.TS_ID ='" + TS_ID + "' AND DTT_CODE='" + DTT_CODE + "' AND COALESCE(LOCKED_BY,' ') IS NOT NULL UNION ALL " + 'SELECT TS1.TS_ID,TS1.PARENT_TS_ID FROM <tran_db>.TRANSACTION_SET TS1, RECUR R1 WHERE TS1.TS_ID = R1.PARENT_TS_ID)SELECT * FROM RECUR )VW';
                        } else {
                          strChkQry = '(WITH RECURSIVE RECUR(TS_ID,PARENT_TS_ID) AS (' + "SELECT TS_ID,PARENT_TS_ID FROM <tran_db>.TRANSACTION_SET TS WHERE TS.TS_ID ='" + TS_ID + "' AND DTT_CODE='" + DTT_CODE + "' AND COALESCE(LOCKED_BY,' ') IS NOT NULL UNION ALL " + 'SELECT TS1.TS_ID,TS1.PARENT_TS_ID FROM <tran_db>.TRANSACTION_SET TS1, RECUR R1 WHERE TS1.TS_ID = R1.PARENT_TS_ID)SELECT * FROM RECUR )VW';
                        }

                        const strSubQry = 'select count(*)  from ' + strChkQry;
                        _ExecuteTranQuery(pTranDB, strSubQry, objLogInfo, function (pRes) {
                          try {
                            var resSubQry = pRes;
                            if (resSubQry != '') {
                              var strTSQry = '';
                              if (pTranDB.DBConn.DBType == 'oracledb') {
                                strTSQry = 'WITH  RECUR(TS_ID,PARENT_TS_ID) AS(' + "SELECT TS_ID,PARENT_TS_ID FROM <tran_db>.TRANSACTION_SET TS WHERE TS.TS_ID ='" + TS_ID + "'UNION ALL " + 'SELECT TS1.TS_ID,TS1.PARENT_TS_ID FROM <tran_db>.TRANSACTION_SET TS1, RECUR R1 WHERE TS1.PARENT_TS_ID = R1.TS_ID)SELECT TS_ID FROM RECUR';
                              } else {
                                strTSQry = 'WITH RECURSIVE RECUR(TS_ID,PARENT_TS_ID) AS(' + "SELECT TS_ID,PARENT_TS_ID FROM <tran_db>.TRANSACTION_SET TS WHERE TS.TS_ID ='" + TS_ID + "'UNION ALL " + 'SELECT TS1.TS_ID,TS1.PARENT_TS_ID FROM <tran_db>.TRANSACTION_SET TS1, RECUR R1 WHERE TS1.PARENT_TS_ID = R1.TS_ID)SELECT TS_ID FROM RECUR';
                              }

                              //const strTSQry = 'WITH RECURSIVE RECUR(TS_ID,PARENT_TS_ID) AS(' + "SELECT TS_ID,PARENT_TS_ID FROM TRANSACTION_SET TS WHERE TS.TS_ID ='" + TS_ID + "'UNION ALL " + 'SELECT TS1.TS_ID,TS1.PARENT_TS_ID FROM TRANSACTION_SET TS1, RECUR R1 WHERE TS1.PARENT_TS_ID = R1.TS_ID)SELECT TS_ID FROM RECUR';
                              const strLockQry = "UPDATE <tran_db>.TRANSACTION_SET SET LOCKED_BY='" + UID + "' ," + "LOCKED_BY_NAME ='" + pLoginName.toUpperCase() + "' WHERE TS_ID in(" + strTSQry + ")" + "AND LOCKED_BY IS NULL";
                              reqInstanceHelper.PrintInfo(serviceName, 'Updating <tran_db>.TRANSACTION_SET for locking type HIERARCHICAL_SELECT', objLogInfo);
                              _ExecuteTranQuery(pTranDB, strLockQry, objLogInfo, function (pRes) {
                                try {

                                  _GetTransetdata(pTranDB, UID, TS_ID, objLogInfo, callbackLockRecord);
                                  // var resSubQry = pRes;
                                  // resObj = sendMethodResponse('SUCCESS', 'Transaction Set Locked Successfully', resSubQry, '', '', '');
                                  // callbackLockRecord(resObj);
                                } catch (error) {
                                  resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-41712', 'Transaction Set Lock Failed', error);
                                  callbackLockRecord(resObj);
                                }
                              });
                            } else {
                              resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-41713', 'Transaction Set Lock not called', error);
                              callbackLockRecord(resObj);
                            }
                          } catch (error) {
                            resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-41714', 'Exception occured while executing count query', error);
                            callbackLockRecord(resObj);
                          }
                        });
                      } catch (error) {
                        resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-41715', 'Exception occured during Hierarchial lock call', error);
                        callbackLockRecord(resObj);
                      }
                    } else {
                      resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-41711', 'Locking mode is incorrect', '');
                      callbackLockRecord(resObj);
                    }
                  } catch (error) {
                    resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-41716', 'Exception occured initially', error);
                    callbackLockRecord(resObj);
                  }
                } else if (Dttcatagory == 'M') {
                  try {
                    reqInstanceHelper.PrintInfo(serviceName, 'DttCategory is M', objLogInfo);
                    var ChecklockCond = '';
                    if (TargetColumn != '' && TargetTable != '') {
                      ChecklockCond = TargetColumn + "='" + TS_ID + "'AND LOCKED_BY IS NOT NULL";
                      reqTranDBInstance.GetTableFromTranDB(pTranDB, TargetTable, ChecklockCond, objLogInfo, function callbackGetTableFromTranDB(pResult, pError) {
                        try {
                          if (error) {
                            resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-41717', 'Error while executing query', error);
                            callbackLockRecord(resObj);
                          } else {
                            if (pResult != '')
                              LockCount = pResult.rows.length;
                            else {
                              LockCount = 0;
                            }
                          }
                          reqInstanceHelper.PrintInfo(serviceName, 'Lock Count is ' + LockCount, objLogInfo);
                          if (LockCount > 0) {
                            try {
                              var CheckLockQuery = "UPDATE $TARGET_TABLE SET LOCKED_BY='$UID', LOCKED_BY_NAME='$LOGIN_NAME' where $TARGET_COLUMN = $TS_ID";
                              CheckLockQuery = CheckLockQuery.replace(/@UID/g, "'" + UID + "'");
                              CheckLockQuery = CheckLockQuery.replace(/@TS_ID/g, "'" + TS_ID + "'");
                              CheckLockQuery = CheckLockQuery.replace(/@LOCKED_BY_NAME/g, "'" + pLoginName + "'");
                              CheckLockQuery = CheckLockQuery.replace(/@TARGET_COLUMN/g, "'" + TargetColumn + "'");
                              reqInstanceHelper.PrintInfo(serviceName, 'Updating Locked by for targetted table', objLogInfo);
                              _ExecuteTranQuery(pTranDB, CheckLockQuery, objLogInfo, function (pRes) {
                                if (pRes != '')
                                  resObj = sendMethodResponse('SUCCESS', 'Update query executed successfully', pRes, '', '', '');
                                callbackLockRecord(resObj);
                              });
                            } catch (error) {
                              resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-41718', 'Exception while updating locking', error);
                              callbackLockRecord(resObj);
                            }
                          } else {
                            resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-41726', 'Target table not locked. Locking record count is 0', error);
                            callbackLockRecord(resObj);
                          }
                        } catch (error) {
                          resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-41719', 'Exception occured', error);
                          callbackLockRecord(resObj);
                        }
                      });
                    }
                  } catch (error) {
                    resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-41720', 'Exception occured', error);
                    callbackLockRecord(resObj);
                  }
                }
              }
            } catch (error) {
              resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-41721', 'Exception occured', error);
              callbackLockRecord(resObj);
            }
          });
          // }
          // }
        } catch (error) {
          resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-41722', 'Exception occured', error);
          callbackLockRecord(resObj);
        }
        // });
      }
      // });
    }
    // Mode Preocess Lock, WF-Update or change status
    else if (LockingMode === 'PROCESS_LOCK') {
      reqInstanceHelper.PrintInfo(serviceName, 'RecordLock Start Time :' + reqDateFormat(new Date(), "yyyy-mmm-dd HH:MM:ss TT"), objLogInfo);
      reqInstanceHelper.PrintInfo(serviceName, 'Process Lock execution begins', objLogInfo);
      var QUERY_RECORD_LOCK_PROCESS = "UPDATE <tran_db>.TRANSACTION_SET TS SET LOCKED_BY = @UID,  LOCKED_BY_NAME = @LOGIN_NAME  WHERE (COALESCE(TS.LOCKED_BY,'') = '' OR TS.LOCKED_BY IS NULL OR TS.LOCKED_BY = '" + UID + "') AND TS.TS_ID IN (SELECT TS_ID FROM TMP_FINAL_ITEMS WHERE PRCT_ID ='" + TokenId + "')";
      QUERY_RECORD_LOCK_PROCESS = QUERY_RECORD_LOCK_PROCESS.replace(/@UID/g, "'" + UID + "'");
      QUERY_RECORD_LOCK_PROCESS = QUERY_RECORD_LOCK_PROCESS.replace(/@STS_ID/g, "'" + STS_ID + "'");
      QUERY_RECORD_LOCK_PROCESS = QUERY_RECORD_LOCK_PROCESS.replace(/@CURRENT_DATE/g, "'" + new Date() + "'");
      QUERY_RECORD_LOCK_PROCESS = QUERY_RECORD_LOCK_PROCESS.replace(/@LOGIN_NAME/g, "'" + pLoginName + "'");
      QUERY_RECORD_LOCK_PROCESS = QUERY_RECORD_LOCK_PROCESS.replace(/@LOCKED_BY_NAME/g, "'" + pLoginName + "'");
      reqInstanceHelper.PrintInfo(serviceName, 'Updating Transaction Set for UID ~~~~~~~ ' + UID + ' ..... AND QUERY IS ' + QUERY_RECORD_LOCK_PROCESS, objLogInfo);
      _ExecuteTranQuery(pTranDB, QUERY_RECORD_LOCK_PROCESS, objLogInfo, function (response) {
        reqInstanceHelper.PrintInfo(serviceName, 'RecordLock End Time :' + reqDateFormat(new Date(), "yyyy-mmm-dd HH:MM:ss TT"), objLogInfo);
        if (response && response !== '') {
          resObj = sendMethodResponse('SUCCESS', 'Locking process completed successfully', response, '', '', '');
          callbackLockRecord(resObj);
        } else {
          resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-41723', 'Exception occured', '');
          callbackLockRecord(resObj);
        }
      });
    }
    // Mode Load Lock Wf-Select calling
    else if (LockingMode === 'LOCK_LOAD') {
      reqInstanceHelper.PrintInfo(serviceName, 'Lock Load Execution begins', objLogInfo);
      reqInstanceHelper.PrintInfo(serviceName, 'Record Unlock called for Lock Load', objLogInfo);
      objSpRecordUnLock.RecordUnLock(pAppId, UID, STS_ID, TokenId, LockingMode, LockingType, CurrentTime, pTranDB, pLoginName, objLogInfo, mDepcas, {}, function (Unlock) {
        var QUERY_LOCK_LOAD = '';
        QUERY_LOCK_LOAD = "UPDATE <tran_db>.TRANSACTION_SET  SET LOCKED_BY ='" + UID + "',LOCKED_BY_NAME ='" + pLoginName + "' WHERE (COALESCE (LOCKED_BY ,'')='' OR LOCKED_BY = '" + UID + "') AND TS_ID IN ";
        if (pTranDB.DBConn.DBType == 'oracledb') {
          QUERY_LOCK_LOAD = "UPDATE <tran_db>.TRANSACTION_SET  SET LOCKED_BY ='" + UID + "',LOCKED_BY_NAME ='" + pLoginName + "' WHERE (COALESCE (LOCKED_BY ,'') IS NULL OR LOCKED_BY = '" + UID + "') AND TS_ID IN ";
        }

        if (LockingType == 'SINGLE_ALL') {
          QUERY_LOCK_LOAD = QUERY_LOCK_LOAD + ' ( SELECT DISTINCT TS_ID FROM ( ' + LockQuery + ' ) A )';
        } else if (LockingType == 'SINGLE_COUNT') {
          if (pTranDB.DBConn.DBType == 'oracledb') {
            QUERY_LOCK_LOAD = QUERY_LOCK_LOAD + ' ( SELECT DISTINCT TS_ID FROM ( ' + LockQuery + ") A WHERE  (COALESCE (LOCKED_BY ,'') IS NULL OR LOCKED_BY = '" + UID + "')  AND ROWNUM <= " + LockingCount + ')';
          } else {
            QUERY_LOCK_LOAD = QUERY_LOCK_LOAD + ' ( SELECT DISTINCT TS_ID FROM ( ' + LockQuery + ") A WHERE  (COALESCE (LOCKED_BY ,'')=''  OR LOCKED_BY = '" + UID + "')  LIMIT " + LockingCount + ')';
          }
        } else if (LockingType == 'HIERARCHICAL_ALL') {
          if (pTranDB.DBConn.DBType == 'oracledb') {
            QUERY_LOCK_LOAD = QUERY_LOCK_LOAD + " (  WITH  RECUR_SELECT(TS_ID) AS ( SELECT DISTINCT  TS_ID,LOCKED_BY FROM ( SELECT  TS_ID,LOCKED_BY FROM ( " + LockQuery + "  ) A1 WHERE (COALESCE(LOCKED_BY,'') = '' OR LOCKED_BY = '" + UID + "') AND ROWNUM <= " + LockingCount + ") B UNION ALL SELECT CHILD.TS_ID,CHILD.LOCKED_BY FROM <tran_db>.TRANSACTION_SET  CHILD JOIN RECUR_SELECT PARENT ON CHILD.PARENT_TS_ID=PARENT.TS_ID AND (COALESCE(CHILD.LOCKED_BY,'') = '' OR CHILD.LOCKED_BY = '" + UID + "') ) SELECT TS_ID FROM RECUR_SELECT )";
          } else {
            QUERY_LOCK_LOAD = QUERY_LOCK_LOAD + " (  WITH RECURSIVE RECUR_SELECT(TS_ID) AS ( SELECT DISTINCT TS_ID,LOCKED_BY FROM ( SELECT  TS_ID,LOCKED_BY FROM ( " + LockQuery + "  ) A1 WHERE (COALESCE(LOCKED_BY,'') = '' OR LOCKED_BY = '" + UID + "' ) LIMIT " + LockingCount + ") B UNION ALL SELECT CHILD.TS_ID,CHILD.LOCKED_BY FROM <tran_db>.TRANSACTION_SET  CHILD JOIN RECUR_SELECT PARENT ON CHILD.PARENT_TS_ID=PARENT.TS_ID AND (COALESCE(CHILD.LOCKED_BY,'') = '' OR CHILD.LOCKED_BY = '" + UID + "') ) SELECT TS_ID FROM RECUR_SELECT )";
          }
        } else if (LockingType == 'HIERARCHICAL_COUNT') {
          if (pTranDB.DBConn.DBType == 'oracledb') {
            QUERY_LOCK_LOAD = QUERY_LOCK_LOAD + ' ( WITH RECUR_SELECT(TS_ID) AS (  SELECT DISTINCT TS_ID,LOCKED_BY FROM (SELECT  TS_ID,LOCKED_BY FROM ( ' + LockQuery + ") A WHERE (COALESCE(LOCKED_BY,'') = '' OR LOCKED_BY = '" + UID + "') AND ROWNUM <= " + LockingCount + ")B UNION ALL SELECT CHILD.TS_ID,CHILD.LOCKED_BY FROM <tran_db>.TRANSACTION_SET CHILD JOIN RECUR_SELECT PARENT ON CHILD.PARENT_TS_ID=PARENT.TS_ID AND (COALESCE(CHILD.LOCKED_BY,'') = '' OR CHILD.LOCKED_BY = '" + UID + "')) SELECT TS_ID FROM RECUR_SELECT )";
          } else {
            QUERY_LOCK_LOAD = QUERY_LOCK_LOAD + ' (  WITH RECURSIVE RECUR_SELECT(TS_ID) AS ( SELECT DISTINCT TS_ID,LOCKED_BY FROM ( SELECT  TS_ID,LOCKED_BY FROM ( ' + LockQuery + ") A WHERE (COALESCE(LOCKED_BY,'') = '' OR LOCKED_BY = '" + UID + "' ) LIMIT " + LockingCount + ")B  UNION ALL SELECT CHILD.TS_ID,CHILD.LOCKED_BY FROM <tran_db>.TRANSACTION_SET CHILD JOIN RECUR_SELECT PARENT ON CHILD.PARENT_TS_ID=PARENT.TS_ID AND (COALESCE(CHILD.LOCKED_BY,'') = '' OR CHILD.LOCKED_BY = '" + UID + "') ) SELECT TS_ID FROM RECUR_SELECT  )";
          }
        }
        // else {
        //     // Currently no operations
        // }

        _ExecuteTranQuery(pTranDB, QUERY_LOCK_LOAD, objLogInfo, function (response) {
          if (response && response !== '') {
            resObj = sendMethodResponse('SUCCESS', 'Locking process completed successfully', response, '', '', '');
            callbackLockRecord(resObj);
          } else {
            resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-41724', 'Exception occured', '');
            callbackLockRecord(resObj);
          }
        });
      });
    } else {
      resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-41725', 'Incorrect Locking Mode', '');
      callbackLockRecord(resObj);
    }
  });
}

function GetTransactionset(pTranDB, pTsId, objLogInfo) {
  return new Promise((resolve, reject) => {
    var Condobj = {
      ts_id: pTsId
    };
    var trsetQry = `select * from <tran_db>.TRANSACTION_SET where ts_id='${pTsId}' `;
    // reqTranDBInstance.GetTableFromTranDB(pTranDB, 'TRANSACTION_SET', Condobj, objLogInfo, function (Res, err) {
    reqTranDBInstance.ExecuteSQLQuery(pTranDB, trsetQry, objLogInfo, function (Res, err) {
      if (err) {
        reject(err);
      } else {
        resolve(Res.rows);
      }
    });
  });
}

// Execute query in transaction DB
function _ExecuteTranQuery(tranDB, query, logInfo, callbackExec) {
  reqTranDBInstance.ExecuteSQLQuery(tranDB, query, logInfo, function callback(resp) {
    callbackExec(resp);
  });
}


function _GetTransetdata(pTranDB, UID, pTsId, objLogInfo, callbackLockRecord) {
  var Condobj = {};
  Condobj.TS_ID = pTsId;
  // Condobj.LOCKED_BY = UID;
  var resObj = {};
  reqTranDBInstance.GetTableFromTranDB(pTranDB, 'TRANSACTION_SET', Condobj, objLogInfo, function (Res, err) {
    if (err) {
      resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-41732', 'After lock query Transaction Set failed ', err);
      callbackLockRecord(resObj);
    } else {
      if (Res.length) {
        if (Res[0].locked_by != '' && Res[0].locked_by != UID) {
          resObj = sendMethodResponse('FAILURE', '', null, '', JSON.stringify(Res[0]), '');
          callbackLockRecord(resObj);
        } else if (Res[0].locked_by != '' && Res[0].locked_by == UID) {
          // SUCCESS Case
          resObj = sendMethodResponse('SUCCESS', '', JSON.stringify(Res[0]), '', '', '');
          callbackLockRecord(resObj);
        } else {
          Res[0].locked_by = '-';
          resObj = sendMethodResponse('FAILURE', '', null, '', JSON.stringify(Res[0]), '');
          callbackLockRecord(resObj);
        }
      } else {
        resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-41733', 'Transaction Set Lock Failed. ', 'No record found.');
        callbackLockRecord(resObj);
      }
    }
  });
}

// Execute query in framework DB
function _ExecuteFXQuery(casInst, query, callbackExecCassandra) {
  casInst.execute(query, [], {
    prepare: true
  }, function callback(pErr, pResult) {
    if (pErr) {
      response = pErr;
    } else {
      response = pResult;
    }
    callbackExecCassandra(response);
  });
}

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
  RecordLock: LockRecord
};
/*********** End of File **********/