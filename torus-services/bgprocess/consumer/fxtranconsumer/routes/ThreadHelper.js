/****
  @Descriptions                 : Child Thread for reading History common table(HST_TRAN_DATA),
                                  and produce it SOLR/KAFKA
                                  For Ultimate - Produsing data to kafka
                                  For Lite     - Insert data to solr  
  @Last_Error_Code              : ERR-FXTRAN-THREADHELPER-0027
  @RECOVERY_ERROR_CODE_SAMPLE   : BG-AUDIT-RECOVERY-CODE-0001
 ****/

// Require dependencies
var reqLinq = require('node-linq').LINQ;
var cron = require('node-cron');
var reqUuid = require('uuid');
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../../../torus-references/instance/DBInstance');
var reqTranDBInstance = require('../../../../../torus-references/instance/TranDBInstance');
var reqProducer = require('../../../../../torus-references/common/Producer');
var reqHelper = require('./Helper');
var reqAsync = require('async');
var reqLogWriter = require('../../../../../torus-references/log/trace/LogWriter');

// Global variable initialization
var serviceName = 'FxTranThreadHelper';
var strStartIndex = '';
var blnError = false;
var tasks = [];
var objLogInfo = null;
var arrDttInfo = []; // Storing DTT Info Table Data For Checking Need Index column value for Moving Data into Solr
// Initiate a new scheduler thread using node-cron
function initiateThread(pMsg, callback) {
    try {
        var initiateThread = {};
        if (pMsg.LogInfo) {
            objLogInfo = pMsg.LogInfo;
        }
        var headers = pMsg.Header;
        var routingkey = headers.routingkey;
        _InitializeDB(headers, function callbackInitializeDB(pDepCas, pTranDB) {
            if (!pDepCas || !pTranDB) {
                initiateThread.status = 'FAILURE';
                initiateThread.errorInfo = 'Error in Getting DB Connections';
                callback(initiateThread);
            } else {
                var dttInfoReqObj = {
                    dep_cas_instance: pDepCas,
                    objLogInfo: pMsg.LogInfo
                };
                reqHelper.GetDTInfo(pDepCas, pMsg.LogInfo, headers, function callbackGetDTInfo() {
                    reqHelper.GetDTTInfo(dttInfoReqObj, function callbackGetDTInfo(error, result) {
                        if (error) {
                            _TraceError(error, headers, 'ERR-FXTRAN-THREADHELPER-0027', 'Error in GetDTTInfo();...So Need to restart the Service or Check the DB Connection...');
                        } else {
                            arrDttInfo = result.rows;
                        }
                        initiateThread.status = 'SUCCESS';
                        initiateThread.dep_cas_instance = pDepCas;
                        initiateThread.tran_db_instance = pTranDB;
                        callback(initiateThread);
                    });
                });
            }
        });
    } catch (error) {
        initiateThread.status = 'FAILURE';
        initiateThread.errorObj = error;
        initiateThread.errorInfo = 'Catch Error in initiateThread();';
        callback(initiateThread);
    }
}


// Initialize dep cas and tran db instances 
function _InitializeDB(pHeader, pCallback) {
    try {
        var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
        reqTranDBInstance.LoadFxDBClient(serviceModel);
        reqDBInstance.GetFXDBConnection(pHeader, 'dep_cas', objLogInfo, function CallbackGetCassandraConn(pClient) {
            var mDepCas = pClient;
            reqTranDBInstance.LoadTranDBClient(serviceModel);
            reqTranDBInstance.GetTranDBConn(pHeader, false, function (pSession) {
                // reqTranDBInstance.GetTranDBConn(pHeader, true, function (pSession) {
                _TraceInfo('Initialze DB ended')
                pCallback(mDepCas, pSession)
            });
        });
    } catch (ex) {
        _TraceError(ex, pHeader, 'ERR-FXTRAN-THREADHELPER-0003', 'Catch Error in _InitializeDB();...');
        pCallback(null, null);
    }
}



// Prepare json message and produce it
function _PrepareAndSaveKafkaMsg(pDepCas, pSession, pAppID, pResult, pArrId, pArrSolrInsertFailedData, pArrParsingFailedData, pHeader, pLogInfo, pOptionalParam, pCallback) {
    try {
        var prepareMsgInfo = {};
        _TraceInfo('Preparing the message that to be produced');
        var objKafkaMessage = '';
        _PrepareMessage(pDepCas, pSession, pResult, pArrParsingFailedData, pHeader, pLogInfo, function callbackPrepareMessage(pKafkaMsg) {
            // _PrepareMessage(pDepCas, pSession, pResult.rows[pIndex], pArrParsingFailedData, pHeader, pLogInfo, function callbackPrepareMessage(pKafkaMsg) {
            try {
                var reqObj = {
                    headers: pHeader,
                    solrData: pKafkaMsg,
                    objLogInfo: pLogInfo
                };
                prepareMsgInfo.status = 'SUCCESS';
                prepareMsgInfo.data = reqObj;
                pCallback(prepareMsgInfo);
            }
            catch (ex) {
                prepareMsgInfo.status = 'FAILURE';
                prepareMsgInfo.errorObj = ex;
                prepareMsgInfo.errorInfo = 'Ctach Error in _PrepareMessage()';
                _TraceError(ex, pHeader, 'ERR-FXTRAN-THREADHELPER-0013', 'Catch Error in _PrepareMessage() Callback...');
                pCallback(prepareMsgInfo);
            }
        })
    } catch (ex) {
        _TraceError(ex, pHeader, 'ERR-FXTRAN-THREADHELPER-0012', 'Catch Error in _PrepareAndSaveKafkaMsg()...');
        prepareMsgInfo.status = 'FAILURE';
        prepareMsgInfo.errorObj = ex;
        prepareMsgInfo.errorInfo = 'Ctach Error in _PrepareAndSaveKafkaMsg()';
        pCallback(prepareMsgInfo);
    }
}


// Prepare json message from data row
function _PrepareMessage(pDepCas, pSession, pRow, pArrParsingFailedData, pHeader, pLogInfo, pCallback) {
    try {
        reqInstanceHelper.PrintInfo(serviceName, '_PrepareMessage started. Current row id is ' + pRow.id, objLogInfo);
        var pCurrentRow = pRow;
        var jsonl = require('json-literal');
        var new_data_json = pCurrentRow['new_data_json'].replace(new RegExp('"', 'g'), '\"'); //for escape "
        var strTemp = jsonl.parse(new_data_json);

        // To verify the old data json value for special characters
        var old_data_json = pCurrentRow['old_data_json']
        if (old_data_json) {
            var strTempOldData = jsonl.parse(old_data_json);
        }

        var strDTCode = (strTemp['DT_CODE'.toLowerCase()] == undefined) ? strTemp['DT_CODE'.toUpperCase()] : strTemp['DT_CODE'.toLowerCase()];
        var strDTTCode = (strTemp['DTT_CODE'.toLowerCase()] == undefined) ? strTemp['DTT_CODE'.toUpperCase()] : strTemp['DTT_CODE'.toLowerCase()]
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

                    objNewData.DT_DESCRIPTION = strDTDesc
                    objNewData.DTT_DESCRIPTION = strDTTDesc

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
                    var str = objNewRow
                    _TraceInfo("_PrepareMessage ended");
                    pCallback(str);
                } else {
                    pCallback({});
                }
            } catch (ex) {
                _TraceError(ex, pHeader, 'ERR-FXTRAN-THREADHELPER-0015', 'Catch Error in FindDTTInfo() Callback...');
                pCallback({});
            }
        })
    } catch (ex) {
        _TraceError(ex, pHeader, 'ERR-FXTRAN-THREADHELPER-0016', 'Catch Error in _PrepareMessage()...');
        // Preparing array for solr insert failed data...
        pArrParsingFailedData.push(pCurrentRow.id);
        pCallback({});
    }
}

function PrepareProduceTranNfxCoreData(params, PrepareProduceTranNfxCoreData) {
    /*  params should contains
         - objLogInfo
         - hst_fx_json 
         - topic_name
         - headers
         - dep_cas_instance
          */
    var PrepareTranCoreDataInfo = {};
    try {
        var objLogInfo = params.objLogInfo || null;
        var headers = params.headers || null;
        // var dep_cas_instance = params.dep_cas_instance || null;
        var topic_name = params.topic_name || null;
        var table_name = params.hst_fx_json.table_name || null;
        var core_unique_id = params.hst_fx_json.core_unique_id || null;
        var newJsonData = JSON.parse(params.hst_fx_json.new_data_json);
        newJsonData = _objKeyToUpperCase(newJsonData);
        // Adding FX Table Core Unique ID
        newJsonData.FTC_ID = core_unique_id;
        newJsonData.FX_TABLE_NAME = table_name.toLowerCase();
        reqProducer.ProduceMessage(topic_name, newJsonData, null, function (res) {
            PrepareTranCoreDataInfo.status = 'SUCCESS';
            PrepareProduceTranNfxCoreData(PrepareTranCoreDataInfo);
        });
    } catch (error) {
        PrepareTranCoreDataInfo.status = 'FAILURE';
        PrepareTranCoreDataInfo.errorObj = error;
        PrepareTranCoreDataInfo.errorInfo = 'Catch Error in PrepareTranCoreData()....';
        PrepareProduceTranNfxCoreData(PrepareTranCoreDataInfo);
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
        _TraceError(error, pHeader, 'ERR-FXTRAN-THREADHELPER-0020', 'Catch Error in _objKeyToUpperCase()...');
    }
}



// To print error messages
function _TraceError(pErrorObj, pHeader, pErrorCode, pErrInfoMesg) {
    try {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, pErrorCode, pErrInfoMesg, pErrorObj);
    }
    catch (e) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-FXTRAN-THREADHELPER-0002', 'Catch Error in _TraceError();...', e);
    }
}

// To print log info messages
function _TraceInfo(pMsg) {
    reqInstanceHelper.PrintInfo(serviceName, pMsg, objLogInfo);
}



module.exports = {
    InitiateThread: initiateThread,
    _PrepareAndSaveKafkaMsg: _PrepareAndSaveKafkaMsg,
    PrepareProduceTranNfxCoreData: PrepareProduceTranNfxCoreData
}
/******** End of File **********/