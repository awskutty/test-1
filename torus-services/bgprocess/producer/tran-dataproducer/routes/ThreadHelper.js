/****
  @Descriptions     :  Child Thread for reading History common table(HST_TRAN_DATA),
                       and produce it SOLR/KAFKA
                       For Ultimate - Produsing data to kafka
                       For Lite     - Insert data to solr  
  @Last_Error_Code  :  ERR-TRANDATA-PRODUCER-0024
 ****/

// Require dependencies
var reqLinq = require('node-linq').LINQ;
var cron = require('node-cron');
var reqUuid = require('uuid');
var reqOs = require('os');
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqDateFormatter = require('../../../../../torus-references/common/dateconverter/DateFormatter');
var reqDBInstance = require('../../../../../torus-references/instance/DBInstance');
var reqTranDBInstance = require('../../../../../torus-references/instance/TranDBInstance');
var reqProducer = require('../../../../../torus-references/common/Producer');
var reqHelper = require('./Helper');
var reqAsync = require('async');
var reqLogWriter = require('../../../../../torus-references/log/trace/LogWriter');


// Global variable initialization
var serviceName = 'TranDataProducer';
var containerName = reqOs.hostname();
var strStartIndex = '';
var blnError = false;
var tasks = [];
var arrRoutingKeys = [];
var maxMemorySize = 300; // In MB
var HistoryTable = 'HST_TRAN_DATA';
var HistoryTableQueryCount = 500;
var deleteFromTable = true;
var restartFlag = false;
var replaceSpecialChar = '';
var lockIDExpiringDuration = '1';
// // Need to Rmmove
// var maxMemorySize = 3; // In MB
// var restartFlag = true;
// var deleteFromTable = false;

// Initiate a new scheduler thread using node-cron
function initiateThread(msgFromMain, callback) {
    var SERVICE_NAME = msgFromMain.SERVICE_NAME;
    var headers = msgFromMain.headers;
    var isTenantMultiThreaded = msgFromMain.headers.IS_TENANT_MULTI_THREADED;

    if (arrRoutingKeys.indexOf(headers.routingkey) == -1) {
        var objLogInfo = JSON.parse(headers.LOG_INFO);
        var GetAllIDsInRoutingKeyObj = { ROUTINGKEY: headers.routingkey };
        var routingkeyInfo = reqInstanceHelper.GetAllIDsInRoutingKey(GetAllIDsInRoutingKeyObj, objLogInfo);
        objLogInfo.TIMEZONE_INFO = routingkeyInfo.TENANT_ID;
        objLogInfo.IS_TENANT_MULTI_THREADED = isTenantMultiThreaded;
        var GetTenantLevelTimezoneObj = { TENANT_ID: routingkeyInfo.TENANT_ID };
        objLogInfo.TIMEZONE_INFO = reqInstanceHelper.GetTenantLevelTimezone(GetTenantLevelTimezoneObj, objLogInfo);
        var objRoutingKey = {
            routingkey: headers.routingkey,
            isDone: true,
            objLogInfo: objLogInfo,
            lastLoopingCount: 0,
            maxLoopingCount: 180
        }
        arrRoutingKeys.push(objRoutingKey);
    }

    reqInstanceHelper.PrintInfo(serviceName, 'Creating new cron job for current key', {});
    var task = cron.schedule('*/10 * * * * *', function () {
        try {
            var currentRoutingKey = headers.routingkey;
            var routingKeyIndex = arrRoutingKeys.findIndex(obj => obj.routingkey == headers.routingkey);

            var objLogInfo = arrRoutingKeys[routingKeyIndex].objLogInfo; // Assiging unique Loginfo for Each Routing Key
            reqInstanceHelper.PrintInfo(serviceName, 'Current Rounting Key - ' + currentRoutingKey, objLogInfo);
            reqInstanceHelper.PrintInfo(serviceName, 'TimeZone Info - ' + objLogInfo.TIMEZONE_INFO, objLogInfo);
            // return;

            reqInstanceHelper.GetRedisServiceParamConfig(null, function (error, result) {
                if (error) {
                    reqInstanceHelper.PrintInfo(serviceName, 'Error While Getting Redis Service Param Config for the key - ' + currentRoutingKey, objLogInfo);
                } else {
                    if (result) {
                        result = JSON.parse(result);
                        var serviceParam = result[SERVICE_NAME];
                        if ('RESTART_MEMORY_VALUE_MB' in serviceParam) {
                            maxMemorySize = serviceParam.RESTART_MEMORY_VALUE_MB;
                        }
                        if ('RESTART_FLAG' in serviceParam) {
                            restartFlag = serviceParam.RESTART_FLAG;
                        }
                        if ('MAX_ELIGIBLE_COUNT' in serviceParam) {
                            HistoryTableQueryCount = serviceParam.MAX_ELIGIBLE_COUNT;
                        }
                        if ('DELETE_PROCESSED_RECORD' in serviceParam) {
                            deleteFromTable = serviceParam.DELETE_PROCESSED_RECORD;
                        }
                        if ('LOCKID_EXPIRING_DURATION_HR' in serviceParam) {
                            lockIDExpiringDuration = serviceParam.LOCKID_EXPIRING_DURATION_HR;
                        }
                        if ('REPLACE_SPECIAL_CHARCTER' in result) {
                            replaceSpecialChar = result.REPLACE_SPECIAL_CHARCTER;
                        }
                    }
                    // // Need to Rmmove
                    // var maxMemorySize = 3; // In MB
                    // var restartFlag = true;
                }
                arrRoutingKeys[routingKeyIndex].lastLoopingCount++;

                if (arrRoutingKeys[routingKeyIndex].isDone) {
                    reqInstanceHelper.PrintInfo(serviceName, 'Next scheduled thread started for the key - ' + currentRoutingKey + ' is Checking For Transaction...', objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, currentRoutingKey + ' - Maximum Memory Size - ' + maxMemorySize + ' MB', objLogInfo);
                    var currentMemorySize = (process.memoryUsage().rss) / (1024 * 1024);
                    reqInstanceHelper.PrintInfo(serviceName, currentRoutingKey + ' - Current Memory Size - ' + currentMemorySize + ' MB', objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, 'Restart Flag - ' + restartFlag, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, 'Special Charcter List - ' + replaceSpecialChar, objLogInfo);

                    if (!restartFlag || currentMemorySize < maxMemorySize) {
                        arrRoutingKeys[routingKeyIndex].isDone = false;
                        _InitializeDB(headers, objLogInfo, function callbackInitializeDB(pDepCas, pTranDB) {
                            if (!pDepCas || !pTranDB) {
                                arrRoutingKeys[routingKeyIndex].isDone = true;
                            } else {
                                DelegateTranDB(pDepCas, pTranDB, msgFromMain.AppId, headers, objLogInfo, function () {
                                    reqInstanceHelper.PrintInfo(serviceName, currentRoutingKey + ' - Tran Data Producer Process Completed...\n\n-----------------------------------------------------------------------------------------------------------------------------------------\n', objLogInfo); //this is for to know api call end'
                                    reqLogWriter.EventUpdate(objLogInfo);
                                    arrRoutingKeys[routingKeyIndex].isDone = true;
                                    arrRoutingKeys[routingKeyIndex].lastLoopingCount = 0;
                                });
                            }
                        });
                    } else {
                        // Going to Restart the Service
                        CheckProcessedMsgCountAndRestart(objLogInfo, function (params) { })
                    }

                } else {
                    _TraceInfo('Already a cron thread is processing. So skiping this cron thread.' + headers.routingkey + ' IsDone = ' + arrRoutingKeys[routingKeyIndex].isDone, objLogInfo);
                    _TraceInfo('Last Looping Count - ' + arrRoutingKeys[routingKeyIndex].lastLoopingCount, objLogInfo);
                    if (arrRoutingKeys[routingKeyIndex].lastLoopingCount > arrRoutingKeys[routingKeyIndex].maxLoopingCount) {
                        _TraceInfo('Looping Count Exceeds the Maximum Looping Count...So Resetting the ISDONE to True', objLogInfo);
                        arrRoutingKeys[routingKeyIndex].isDone = true;
                        arrRoutingKeys[routingKeyIndex].lastLoopingCount = 0;
                    }
                }
            });
            //task.stop(); //this stops scheduler 
        } catch (error) {
            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-TRANDATA-PRODUCER-0001', 'Catch Error in cron.schedule() While adding a New CRON Job...', error);
        }
    });
    tasks.push(task);
    return callback('started');
}

// Query common history table
// Produce it to kafka
// Then delete processed data from table
function DelegateTranDB(pDepCas, pTranDB, pAppID, pHeader, pLogInfo, pCallback) {
    try {
        reqInstanceHelper.PrintInfo(serviceName, 'Starting history table process..', pLogInfo);
        _DoProcessHistoryTable(pDepCas, pTranDB, pAppID, pHeader, pLogInfo, function callbackTranDB(pError, pResult, pRowCount) {
            // Closing The Connection 
            reqInstanceHelper.DestroyConn(serviceName, pLogInfo, function (params) {
                pCallback();
            });
        });
    } catch (ex) {
        _TraceError(ex, pHeader, 'ERR-TRANDATA-PRODUCER-0004', 'Catch Error in DelegateTranDB();...', pLogInfo);
        // Closing The Connection 
        reqInstanceHelper.DestroyConn(serviceName, objLogInfo, function (params) {
            pCallback();
        });
    }
}

// Initialize dep cas and tran db instances 
function _InitializeDB(pHeader, objLogInfo, pCallback) {
    try {
        var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
        reqTranDBInstance.LoadFxDBClient(serviceModel);
        // reqDBInstance.GetFXDBConnection(pHeader, 'dep_cas', objLogInfo, function CallbackGetCassandraConn(pClient) {
        var mDepCas = {};
        reqTranDBInstance.LoadTranDBClient(serviceModel);
        // Getting the TranDb Connection
        pHeader.LOG_INFO = objLogInfo;
        reqTranDBInstance.GetTranDBConn(pHeader, false, function (pSession) {
            _TraceInfo('Initialze DB ended', objLogInfo);
            pCallback(mDepCas, pSession);
        });
        // });
    } catch (ex) {
        _TraceError(ex, pHeader, 'ERR-TRANDATA-PRODUCER-0003', 'Catch Error in _InitializeDB();...', objLogInfo);
        pCallback(null, null);
    }
}

// Query data from HST_TRAN_DATA with limit 100 and produce it to kafka/solr and then delete from table
function _DoProcessHistoryTable(pDepCas, pSession, pAppID, pHeaders, objLogInfo, pCallback) {
    try {
        _TraceInfo('Processing History table started.', objLogInfo);
        var cond = " process_count IS NULL and lock_id IS NULL and UPPER(routingkey) = UPPER('" + pHeaders.routingkey + "') ) T ";
        var strSelQuery = 'SELECT ID FROM ( SELECT ID ,LOCK_ID FROM ' + HistoryTable + ' WHERE ' + cond + ' LIMIT ' + HistoryTableQueryCount;
        var dateFormat = 'YYYY-MM-DD';
        if (pSession.DBConn.DBType.toLowerCase() == 'oracledb') {
            strSelQuery = 'SELECT ID FROM ( SELECT ID , LOCK_ID FROM ' + HistoryTable + ' WHERE ' + cond + ' WHERE ROWNUM <= ' + HistoryTableQueryCount;
            objLogInfo.isFromOracle = true;
            dateFormat = 'DD-MON-YY';
        }
        var lock_id = reqUuid() + '-' + containerName;
        var modifiedDate = reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo);
        var hst_tran_data_prct_update_qry = "update " + HistoryTable + " set lock_id = '" + lock_id + "', MODIFIED_DATE =  '" + modifiedDate + "' WHERE ID IN (" + strSelQuery + ") and process_count IS NULL and lock_id IS NULL";
        var select_after_update_qry = "select * from " + HistoryTable + " where lock_id = '" + lock_id + "'";

        var SeqID = '';
        var RowCount = 0;
        var arrId = [];
        reqAsync.series({
            ProcessHistoryTable: function (parCb) {
                try {
                    reqTranDBInstance.ExecuteSQLQuery(pSession, hst_tran_data_prct_update_qry, objLogInfo, function callbackDeleteHistoryTable(result, error) {
                        if (error) {
                            _TraceError(error, pHeaders, 'ERR-TRANDATA-PRODUCER-0005', 'Error While Executing hst_tran_data_prct_update_qry in ExecuteSQLQuery()...', objLogInfo);
                            parCb(error, null);
                        } else {
                            // select_after_update_qry = 'select * from hst_tran_data where ID =28402135';
                            reqTranDBInstance.ExecuteSQLQuery(pSession, select_after_update_qry, objLogInfo, function callbackDeleteHistoryTable(result, error) {
                                if (error) {
                                    _TraceError(error, pHeaders, 'ERR-TRANDATA-PRODUCER-0021', 'Error While Executing select_after_update_qry in ExecuteSQLQuery()...', objLogInfo);
                                    parCb(error, null);
                                } else {
                                    var pResult = {};
                                    pResult.rows = new reqLinq(result.rows)
                                        .OrderBy(function (row) {
                                            return row.id;
                                        })
                                        .Select(function (row) {
                                            try {
                                                if (pSession.DBConn.DBType.toLowerCase() == 'oracledb') {
                                                    // To verify the New and old data json value for special characters
                                                    if (row.new_data_json) {
                                                        row.new_data_json = reqInstanceHelper.ReplaceSpecialCharacter(row.new_data_json, replaceSpecialChar.split(','));
                                                    }

                                                    // To verify the old data json value for special characters
                                                    if (row.old_data_json) {
                                                        row.old_data_json = reqInstanceHelper.ReplaceSpecialCharacter(row.old_data_json, replaceSpecialChar.split(','));
                                                    }
                                                }
                                            } catch (error) {
                                                _TraceError(error, pHeaders, 'ERR-TRANDATA-PRODUCER-0024', 'Catch Error while Replacing Special Character within the HST data', objLogInfo);
                                            }
                                            return row;
                                        })
                                        .ToArray();

                                    if (pResult) {
                                        RowCount = pResult.rows.length;
                                        if (pResult.rows.length == 0)
                                            parCb(null, 'SUCCESS');
                                        else {
                                            if (blnError && strStartIndex == pResult.rows[0]['id']) {
                                                _TraceError('Error', pHeaders, 'ERR-TRANDATA-PRODUCER-0006', 'Already produced the sequenceID into Kafka - ' + pResult.rows[0]['id'], objLogInfo);
                                                parCb(null, 'SUCCESS');
                                            } else {
                                                var index = 0;
                                                _PrepareAndSaveKafkaMsg(pDepCas, pSession, pAppID, index, RowCount, pResult, SeqID, arrId, pHeaders, objLogInfo, function callbackPrepareAndSaveKafkaMsg(pSeqID) {
                                                    arrId = pSeqID;
                                                    parCb(null, 'SUCCESS');
                                                })
                                            }
                                        }
                                    }
                                }
                            });
                        }
                    });
                }
                catch (ex) {
                    _TraceError(ex, pHeaders, 'ERR-TRANDATA-PRODUCER-0007', 'Catch Error in Async Series ProcessHistoryTable();...', objLogInfo);
                    parCb(ex, null);
                }
            },
            UpdateHistory: function (UpdateHistoryCB) {
                try {
                    // deleteFromTable = true;
                    if (!deleteFromTable) {
                        if (arrId.length) {
                            _TraceInfo('Update Count - ' + arrId.length, objLogInfo);
                            reqTranDBInstance.UpdateTranDB(pSession, HistoryTable, {
                                'PROCESS_COUNT': 1,
                                'LOCK_ID': null,
                                'MODIFIED_DATE': reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo)
                            }, {
                                'ID': arrId
                            }, objLogInfo, function (pResult, pError) {
                                if (pError) {
                                    _TraceError(pError, pHeaders, 'ERR-TRANDATA-PRODUCER-0008', 'Error in Async Series DeleteHistory - UpdateTranDB();...', objLogInfo);
                                    blnError = true;
                                }
                                arrId = [];
                                UpdateHistoryCB(pError, pResult);
                            }
                            );
                        } else {
                            _TraceInfo('There is No Eligible Data For Update Process', objLogInfo);
                            UpdateHistoryCB(null, 'SUCCESS');
                        }
                    } else {
                        _TraceInfo('Skipping The Update Process because Delete From Table is Enabled', objLogInfo);
                        UpdateHistoryCB(null, 'SUCCESS');
                    }
                } catch (ex) {
                    _TraceError(ex, pHeaders, 'ERR-TRANDATA-PRODUCER-0009', 'Catch Error in Async Series DeleteHistory();...');
                    UpdateHistoryCB(ex, null);
                }
            },
            DeleteHistory: function (DeleteHistoryCB) {
                try {
                    // deleteFromTable = false; // @@@
                    if (deleteFromTable) {
                        if (arrId.length) {
                            _TraceInfo('Delete Count - ' + arrId.length, objLogInfo);
                            reqTranDBInstance.DeleteTranDB(pSession, HistoryTable, {
                                'ID': arrId
                            }, objLogInfo, function (pResult, pError) {
                                if (pError) {
                                    _TraceError(pError, pHeaders, 'ERR-TRANDATA-PRODUCER-0008', 'Error in Async Series DeleteHistory - DeleteTranDB();...', objLogInfo);
                                }
                                arrId = [];
                                DeleteHistoryCB(pError, pResult);
                            }
                            );
                        } else {
                            _TraceInfo('There is No Eligible Data For Delete Process', objLogInfo);
                            DeleteHistoryCB(null, 'SUCCESS');
                        }
                    } else {
                        _TraceInfo('Delete From Table is Not Enabled', objLogInfo);
                        DeleteHistoryCB(null, 'SUCCESS');
                    }
                } catch (ex) {
                    _TraceError(ex, pHeaders, 'ERR-TRANDATA-PRODUCER-0009', 'Catch Error in Async Series DeleteHistory();...');
                    DeleteHistoryCB(ex, null);
                }
            }
            , HandlingOldLockIDs: function (HandlingOldLockIDsCB) {
                try {
                    var modifiedDate = reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo);
                    var cond = ' AND LOCK_ID IS NOT NULL';
                    var handlingOldLockIDDataQry = "select ID from " + HistoryTable + " WHERE MODIFIED_DATE <= cast('" + modifiedDate + "' as timestamp)  - INTERVAL '" + lockIDExpiringDuration + "' HOUR " + cond;
                    if (pSession.DBConn.DBType.toLowerCase() == 'oracledb') {
                        handlingOldLockIDDataQry = handlingOldLockIDDataQry + ' AND ROWNUM <= ' + HistoryTableQueryCount;
                    } else {
                        handlingOldLockIDDataQry = handlingOldLockIDDataQry + ' LIMIT ' + HistoryTableQueryCount;
                    }
                    var handlingOldLockIDDataUpdateQry = "UPDATE " + HistoryTable + " SET LOCK_ID = NULL, MODIFIED_DATE = '" + modifiedDate + "', COMMENTS = 'Making Old Lock IDs to NULL' WHERE ID IN (" + handlingOldLockIDDataQry + ") AND PROCESS_COUNT IS NULL and LOCK_ID IS NOT NULL";
                    reqTranDBInstance.ExecuteSQLQuery(pSession, handlingOldLockIDDataUpdateQry, objLogInfo, function (result, error) {
                        if (error) {
                            _TraceError(error, pHeaders, 'ERR-TRANDATA-PRODUCER-0023', 'Error While Executing handlingOldLockIDDataQry in ExecuteSQLQuery()...', objLogInfo);
                        }
                        HandlingOldLockIDsCB();
                    });

                } catch (ex) {
                    _TraceError(ex, pHeaders, 'ERR-TRANDATA-PRODUCER-0009', 'Catch Error in Async Series DeleteHistory();...');
                    HandlingOldLockIDsCB(ex, null);
                }
            }
        },
            function (err, results) {
                if (err) {
                    _TraceError(err, pHeaders, 'ERR-TRANDATA-PRODUCER-0010', 'Error in Async Series Final Callback();...');
                } else {
                    _TraceInfo("History table processing and Update PRocess Count process completed", objLogInfo);
                }
                pCallback(err, results, RowCount);
            });
    } catch (ex) {
        _TraceError(ex, pHeaders, 'ERR-TRANDATA-PRODUCER-0011', 'Catch Error in _DoProcessHistoryTable();...');
        pCallback(ex, [], 0);
    }
}



// Prepare json message and produce it
function _PrepareAndSaveKafkaMsg(pDepCas, pSession, pAppID, pIndex, pRowCount, pResult, pSequenceId, parrId, pHeader, pLogInfo, pCallback) {
    try {
        _TraceInfo('Preparing the message that to be produced', pLogInfo);
        // _PrepareMessage(pDepCas, pSession, pResult.rows[pIndex], pHeader, pLogInfo, function callbackPrepareMessage(pKafkaMsg) {
        try {
            _ProduceKafkaMessage(pResult.rows[pIndex]['id'].toString(), pResult.rows[pIndex], pHeader, pLogInfo, function callbackProduceMsg(pStatus, pSeqId) {
                try {
                    if (pStatus == 'SUCCESS') {
                        pSequenceId = pSeqId;//(pSequenceId == '') ? pSeqId : pSequenceId + ',' + pSeqId
                        if (pIndex == 0)
                            strStartIndex = pSeqId;
                        pIndex = pIndex + 1;
                        parrId.push(pSeqId);
                    }
                    if (pIndex == pRowCount || pStatus == 'FAILURE')
                        pCallback(parrId);
                    else {
                        _PrepareAndSaveKafkaMsg(pDepCas, pSession, pAppID, pIndex, pRowCount, pResult, pSequenceId, parrId, pHeader, pLogInfo, pCallback)
                    }
                } catch (ex) {
                    _TraceError(ex, pHeader, 'ERR-TRANDATA-PRODUCER-0014', 'Catch Error in _ProduceKafkaMessage() Callback...');
                    pCallback(parrId);
                }
            })
        } catch (ex) {
            _TraceError(ex, pHeader, 'ERR-TRANDATA-PRODUCER-0013', 'Catch Error in _PrepareMessage() Callback...');
            pCallback(parrId);
        }
        // })
    } catch (ex) {
        _TraceError(ex, pHeader, 'ERR-TRANDATA-PRODUCER-0012', 'Catch Error in _PrepareAndSaveKafkaMsg()...');
        pCallback(parrId);
    }
}

// Prepare json message from data row
function _PrepareMessage(pDepCas, pSession, pRow, pHeader, pLogInfo, pCallback) {
    try {
        reqInstanceHelper.PrintInfo(serviceName, '_PrepareMessage started. Current row id is ' + pRow.id, objLogInfo);
        var pCurrentRow = pRow;
        var jsonl = require('json-literal');
        var new_data_json = pCurrentRow['new_data_json'] //.replace(new RegExp('"', 'g'), '\"'); //for escape "
        var strTemp = jsonl.parse(new_data_json);
        var strDTCode = (strTemp['DT_CODE'.toLowerCase()] == undefined) ? strTemp['DT_CODE'.toUpperCase()] : strTemp['DT_CODE'.toLowerCase()];
        var strDTDesc = (strTemp['DT_DESCRIPTION'.toLowerCase()] == undefined) ? strTemp['DT_DESCRIPTION'.toUpperCase()] : strTemp['DT_DESCRIPTION'.toLowerCase()]
        var strDTTCode = (strTemp['DTT_CODE'.toLowerCase()] == undefined) ? strTemp['DTT_CODE'.toUpperCase()] : strTemp['DTT_CODE'.toLowerCase()]
        var strDTTDesc = (strTemp['DTT_DESCRIPTION'.toLowerCase()] == undefined) ? strTemp['DTT_DESCRIPTION'.toUpperCase()] : strTemp['DTT_DESCRIPTION'.toLowerCase()]
        reqHelper.FindDTTInfo(pDepCas, pLogInfo, pHeader, strDTTCode, pCurrentRow['table_name'], function callbackFindDTTInfo(pDTTInfo) {
            try {
                if (pDTTInfo != null && pDTTInfo != undefined) {
                    var strAppID = pDTTInfo['APP_ID']
                    var strTemp = pDTTInfo['RELATION']
                    var strTargetTable = strTemp['TARGET_TABLE']
                    var strKeyColumn = strTemp['PRIMARY_COLUMN']

                    // Find out insert or update
                    var strOldData = pCurrentRow['old_data_json']
                    var objNewData = jsonl.parse(new_data_json);
                    objNewData = _objKeyToUpperCase(objNewData, pHeader);
                    if (strOldData == null || strOldData == undefined || strOldData == '')
                        objNewData.Key_Value = 0
                    else
                        objNewData.Key_Value = objNewData[strKeyColumn.toLowerCase()]

                    var objTranDataRow = {
                        DT_Code: strDTCode,
                        DTT_Code: strDTTCode,
                        Key_Column: strKeyColumn,
                        TS_Id: 0,
                        Status: '',
                        PWDCtrls: '',
                        DecCtrls: '',
                        Items: [objNewData],
                        Has_status: 'Y',
                        Has_processStatus: 'Y',
                        old_data: strOldData
                    }
                    var objNewRow = {
                        TranData: objTranDataRow,
                        Relation: pDTTInfo['RELATION'],
                        AppId: strAppID
                    }
                    var str = objNewRow;
                    _TraceInfo("_PrepareMessage ended", pLogInfo);
                    pCallback(str);
                } else
                    pCallback({});
            } catch (ex) {
                _TraceError(ex, pHeader, 'ERR-TRANDATA-PRODUCER-0015', 'Catch Error in FindDTTInfo() Callback...', pLogInfo);
                pCallback({});
            }
        })
    } catch (ex) {
        _TraceError(ex, pHeader, 'ERR-TRANDATA-PRODUCER-0016', 'Catch Error in _PrepareMessage()...');
        updateDataProblem(pSession, { id: pCurrentRow.id }, pHeader, function (error) {
            pCallback({});
        });
    }
}

function updateDataProblem(pSession, cond, pHeader, callback) {
    try {
        reqTranDBInstance.UpdateTranDB(pSession, 'HST_TRAN_DATA', { is_processed: 'Y' }, cond, objLogInfo, function (result, error) {
            if (error) {
                _TraceError(error, pHeader, 'ERR-TRANDATA-PRODUCER-0018', 'Error in updateDataProblem - UpdateTranDB()...');
                callback(error);
            } else {
                callback(null);
            }
        });
    } catch (ex) {
        _TraceError(ex, pHeader, 'ERR-TRANDATA-PRODUCER-0017', 'Catch Error in updateDataProblem()...');
        callback(ex);
    }
}

// To Verify and Restart the Service Based on the processed msg Count and Maximum Processing Msg Count
// Temporary Code For Memory Leak
function CheckProcessedMsgCountAndRestart(objLogInfo, CheckProcessedMsgCountAndRestartCB) {
    try {
        var isAllThreadProcessCompleted = true;
        for (let g = 0; g < arrRoutingKeys.length; g++) {
            const element = arrRoutingKeys[g];
            // Checking whether all thread processes are completed
            if (!element.isDone) {
                // Process Not Completed
                isAllThreadProcessCompleted = false;
                reqInstanceHelper.PrintInfo(serviceName, element.routingkey + ' - Process is Not Completed and Service Will not be going to Restart...', objLogInfo);
            }
        }
        if (isAllThreadProcessCompleted) {
            reqInstanceHelper.PrintInfo(serviceName, 'Going to Restart the Service...', objLogInfo);
            reqLogWriter.EventUpdate(objLogInfo);
            reqInstanceHelper.restartSvc(objLogInfo);
        } else {
            reqInstanceHelper.PrintInfo(serviceName, 'Process is Not Completed in some other thread, so waiting to complete the remaining process', objLogInfo);
            reqInstanceHelper.PrintInfo(serviceName, 'Thread Informations - ' + JSON.stringify(arrRoutingKeys), objLogInfo);
            reqLogWriter.EventUpdate(objLogInfo);
        }
    } catch (error) {
        reqInstanceHelper.PrintInfo(serviceName, 'Error While Trying to Restarting the Service - ' + error, objLogInfo);
        CheckProcessedMsgCountAndRestartCB(error, null);
    }
}
// Produce the prepared messages
var kafkaTopic = 'PRF.hst_tran_data';
function _ProduceKafkaMessage(pSeqId, pKafkaObj, pHeaders, objLogInfo, pCallback) {
    if (Object.keys(pKafkaObj).length == 0) {
        _TraceInfo('There is No Data For TRAN ID - ' + pSeqId, objLogInfo);
        pCallback('SUCCESS', pSeqId);
    }
    else {
        try {
            var topicName = '';
            _TraceInfo('Producing Msg Started for TRAN ID - ' + pSeqId);
            if (objLogInfo.isFromOracle) {
                topicName = kafkaTopic.toUpperCase();
            } else {
                topicName = kafkaTopic;
            }
            if (objLogInfo.IS_TENANT_MULTI_THREADED) {
                topicName = topicName + '_' + pHeaders.routingkey;
            }
            topicName = topicName.replace(/~/g, '_'); // If Replace is Not Done then It will not create a Kfka Topic
            _TraceInfo('Current Topic Name - ' + topicName, objLogInfo);
            var kafkaTopicData = { HST_DATA: pKafkaObj, ROUTING_KEY: pHeaders.routingkey };
            // Producing Kafka Msg into Two Different Topics Based on the DB Type
            reqProducer.ProduceMessage(topicName, kafkaTopicData, pHeaders, function (result) {
                reqInstanceHelper.PrintInfo(serviceName, 'Producing Result - ' + result, objLogInfo);
                pCallback(result, pSeqId);
            });
        } catch (ex) {
            _TraceError(ex, pHeaders, 'ERR-TRANDATA-PRODUCER-0019', 'Catch Error in _ProduceKafkaMessage()...', objLogInfo);
            pCallback('SUCCESS', pSeqId);
        }
    }
}

function _objKeyToUpperCase(pObj, pHeader) {
    try {
        var objForReturn = new Object();
        for (var key in pObj) {
            var strUpperCaseKey = key.toUpperCase();
            objForReturn[strUpperCaseKey] = pObj[key];
        }
        return objForReturn;
    } catch (error) {
        _TraceError(error, pHeader, 'ERR-TRANDATA-PRODUCER-0020', 'Catch Error in _objKeyToUpperCase()...');
    }
}

function _ToDate(pDate) {
    var Restr = reqDateFormat(pDate, "yyyy-mm-dd HH:MM:ss:MMM")
    return Restr
}

// To print error messages
function _TraceError(pErrorObj, pHeader, pErrorCode, pErrInfoMesg, pLogInfo) {
    try {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, pErrorCode, pErrInfoMesg, pErrorObj);
        if (arrRoutingKeys.length == 1) {
            arrRoutingKeys[0].isDone = true;
        }
        else {
            var routingKeyIndex = arrRoutingKeys.findIndex(obj => obj.routingkey == pHeader.routingkey);
            arrRoutingKeys[routingKeyIndex].isDone = true;
        }
    }
    catch (e) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-TRANDATA-PRODUCER-0002', 'Catch Error in _TraceError();...', e);
    }
}
// To print log info messages
function _TraceInfo(pMsg, pLogInfo) {
    reqInstanceHelper.PrintInfo(serviceName, pMsg, pLogInfo);
}

module.exports = {
    InitiateThread: initiateThread
}
/******** End of File **********/