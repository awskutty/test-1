/****
  @Descriptions                 : Child Thread for reading History common table(HST_TRAN_DATA),
                                  and produce it SOLR/KAFKA
                                  For Ultimate - Produsing data to kafka
                                  For Lite     - Insert data to solr  
  @Last_Error_Code              : ERR-AUDITDATA-PRODUCER-0027
  @RECOVERY_ERROR_CODE_SAMPLE   : BG-AUDIT-RECOVERY-CODE-0001
 ****/

// Require dependencies
jsonl = require('json-literal');
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../../../torus-references/instance/DBInstance');
var reqTranDBInstance = require('../../../../../torus-references/instance/TranDBInstance');
var reqProducer = require('../../../../../torus-references/common/Producer');
var reqHelper = require('./Helper');

// Global variable initialization
var serviceName = 'AuditDataProducer';
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
                    objLogInfo: pMsg.LogInfo,
                    headers
                };
                reqHelper.GetDTInfo(pDepCas, pMsg.LogInfo, headers, function callbackGetDTInfo() {
                    reqHelper.GetDTTInfo(dttInfoReqObj, function callbackGetDTInfo(error, result) {
                        if (error) {
                            _TraceError(error, headers, 'ERR-AUDITDATA-PRODUCER-0027', 'Error in GetDTTInfo();...So Need to restart the Service or Check the DB Connection...');
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
        _TraceError(ex, pHeader, 'ERR-AUDITDATA-PRODUCER-0003', 'Catch Error in _InitializeDB();...');
        pCallback(null, null);
    }
}



// Prepare json message and produce it
function _PrepareAndSaveKafkaMsg(pDepCas, pSession, pAppID, pResult, pArrId, pArrSolrInsertFailedData, pArrParsingFailedData, pHeader, pLogInfo, pOptionalParam, pCallback) {
    try {
        var prepareMsgInfo = {};
        _TraceInfo('Preparing the message that to be produced');
        _PrepareMessage(pDepCas, pSession, pResult, pArrParsingFailedData, pHeader, pLogInfo, function callbackPrepareMessage(pKafkaMsg, pDTTInfo) {
            try {
                var reqObj = {
                    headers: pHeader,
                    solrData: [pKafkaMsg],
                    objLogInfo: pLogInfo,
                    DTInfo: pDTTInfo
                };
                prepareMsgInfo.status = 'SUCCESS';
                prepareMsgInfo.data = reqObj;
                pCallback(prepareMsgInfo);
                reqObj = {};
                prepareMsgInfo = {};
            }
            catch (ex) {
                prepareMsgInfo.status = 'FAILURE';
                prepareMsgInfo.errorObj = ex;
                prepareMsgInfo.errorInfo = 'Ctach Error in _PrepareMessage()';
                _TraceError(ex, pHeader, 'ERR-AUDITDATA-PRODUCER-0013', 'Catch Error in _PrepareMessage() Callback...');
                pCallback(prepareMsgInfo);
                prepareMsgInfo = {};
                reqObj = {};
            }
        })
    } catch (ex) {
        _TraceError(ex, pHeader, 'ERR-AUDITDATA-PRODUCER-0012', 'Catch Error in _PrepareAndSaveKafkaMsg()...');
        prepareMsgInfo.status = 'FAILURE';
        prepareMsgInfo.errorObj = ex;
        prepareMsgInfo.errorInfo = 'Ctach Error in _PrepareAndSaveKafkaMsg()';
        pCallback(prepareMsgInfo);
        prepareMsgInfo = {};
        reqObj = {};
    }
}


// Prepare json message from data row
function _PrepareMessage(pDepCas, pSession, pRow, pArrParsingFailedData, pHeader, pLogInfo, pCallback) {
    var pCurrentRow = {};
    var new_data_json = {};
    var old_data_json = {};
    var strTempOldData = {};
    var strTemp = {};
    var dtt_data_formats = [];
    var strOldData = {};
    var str = {};
    var objNewData = {};
    var objTranDataRow = {};
    var objNewRow = {};
    var strAppID = '';
    var strDTCode = '';
    var strTargetTable = '';
    var strKeyColumn = '';
    var strDTDesc = '';
    var strDTTDesc = '';
    var strDTTCode = '';
    try {
        reqInstanceHelper.PrintInfo(serviceName, '_PrepareMessage started. Current row id is ' + pRow.id, objLogInfo);
        pCurrentRow = pRow;
        new_data_json = pCurrentRow['new_data_json'].replace(new RegExp('"', 'g'), '\"'); //for escape "
        strTemp = jsonl.parse(new_data_json);

        // To verify the old data json value for special characters
        old_data_json = pCurrentRow['old_data_json']
        if (old_data_json) {
            strTempOldData = jsonl.parse(old_data_json);
        }

        strDTCode = (strTemp['DT_CODE'.toLowerCase()] == undefined) ? strTemp['DT_CODE'.toUpperCase()] : strTemp['DT_CODE'.toLowerCase()];
        strDTDesc = (strTemp['DT_DESCRIPTION'.toLowerCase()] == undefined) ? strTemp['DT_DESCRIPTION'.toUpperCase()] : strTemp['DT_DESCRIPTION'.toLowerCase()]
        strDTTCode = (strTemp['DTT_CODE'.toLowerCase()] == undefined) ? strTemp['DTT_CODE'.toUpperCase()] : strTemp['DTT_CODE'.toLowerCase()]
        strDTTDesc = (strTemp['DTT_DESCRIPTION'.toLowerCase()] == undefined) ? strTemp['DTT_DESCRIPTION'.toUpperCase()] : strTemp['DTT_DESCRIPTION'.toLowerCase()]
        reqHelper.FindDTTInfo(pDepCas, pLogInfo, pHeader, strDTTCode, pCurrentRow['table_name'], function callbackFindDTTInfo(pDTTInfo) {
            try {
                if (pDTTInfo) {
                    strAppID = pDTTInfo['APP_ID'];
                    strTemp = pDTTInfo['RELATION'];
                    dtt_data_formats = strTemp.DTT_DFD_JSON.DATA_FORMATS[0].DF_DETAILS;
                    strTargetTable = strTemp['TARGET_TABLE'];
                    strKeyColumn = strTemp['PRIMARY_COLUMN'];

                    // Find out insert or update
                    strOldData = pCurrentRow['old_data_json'];
                    if (strOldData) {
                        strOldData = jsonl.parse(strOldData);
                        strOldData = _objKeyToUpperCase(strOldData, pHeader);
                    }

                    objNewData = jsonl.parse(new_data_json);
                    objNewData = _objKeyToUpperCase(objNewData, pHeader);
                    if (!strOldData) {
                        objNewData.Key_Value = 0;
                    }
                    else {
                        objNewData.Key_Value = objNewData[strKeyColumn.toUpperCase()];
                    }
                    objNewData.DT_DESCRIPTION = strDTDesc;
                    objNewData.DTT_DESCRIPTION = strDTTDesc;
                    // New Data Json Validation
                    if (!objNewData.DT_DESCRIPTION) {
                        objNewData.DT_DESCRIPTION = strTemp.DT_DESCRIPTION;
                    }
                    if (!objNewData.DT_CODE) {
                        objNewData.DT_CODE = strTemp.DT_CODE;
                        strDTCode = strTemp.DT_CODE;
                    }
                    if (!objNewData.DTT_DESCRIPTION) {
                        objNewData.DTT_DESCRIPTION = strTemp.DTT_DESCRIPTION;
                    }

                    if (strOldData && !strOldData.DT_DESCRIPTION) {
                        strOldData.DT_DESCRIPTION = strTemp.DT_DESCRIPTION;
                    }
                    if (strOldData && !strOldData.DT_CODE) {
                        strOldData.DT_CODE = strTemp.DT_CODE;
                    }
                    if (strOldData && !strOldData.DTT_DESCRIPTION) {
                        strOldData.DTT_DESCRIPTION = strTemp.DTT_DESCRIPTION;
                    }
                    try {
                        if (pLogInfo.isFromOracle) {

                            if (dtt_data_formats.length) { // Only for Oracle DB Type 
                                for (var u = 0; u < dtt_data_formats.length; u++) {
                                    const element = dtt_data_formats[u];
                                    if (element.DATA_TYPE == 'DATETIME') {
                                        for (const key in objNewData) {
                                            if (objNewData[key] && key == element.TARGET_COLUMN) {
                                                objNewData[key] = new Date(objNewData[key].replace(/\./g, ':')).toISOString();
                                                // "modified_date": "2020-03-16T12:27:53.554", // postgres
                                                // "19-OCT-20 10.21.26.0000000 AM" // Oracle
                                            }
                                        }
                                        for (const key in strOldData) {
                                            if (strOldData[key] && key == element.TARGET_COLUMN) {
                                                strOldData[key] = new Date(strOldData[key].replace(/\./g, ':')).toISOString();
                                                // "modified_date": "2020-03-16T12:27:53.554", // postgres
                                                // "19-OCT-20 10.21.26.0000000 AM" // Oracle
                                            }
                                        }
                                    }

                                }
                            }
                            if (objNewData.CREATED_DATE) {
                                objNewData.CREATED_DATE = new Date(objNewData.CREATED_DATE.replace(/\./g, ':')).toISOString();
                            }
                            if (objNewData.MODIFIED_DATE) {
                                objNewData.MODIFIED_DATE = new Date(objNewData.MODIFIED_DATE.replace(/\./g, ':')).toISOString();
                            }
                            // Old Data Json Validation
                            if (strOldData && strOldData.CREATED_DATE) {
                                strOldData.CREATED_DATE = new Date(strOldData.CREATED_DATE.replace(/\./g, ':')).toISOString();
                            }
                            if (strOldData && strOldData.MODIFIED_DATE) {
                                strOldData.MODIFIED_DATE = new Date(strOldData.MODIFIED_DATE.replace(/\./g, ':')).toISOString();
                            }
                        }
                    } catch (error) { }
                    if (strOldData) {
                        strOldData = JSON.stringify(strOldData);
                    }
                    objTranDataRow = {
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
                    };
                    objNewRow = {
                        TranData: objTranDataRow,
                        Relation: pDTTInfo['RELATION'],
                        AppId: strAppID
                    };
                    str = objNewRow;
                    _TraceInfo("_PrepareMessage ended");
                    pCallback(str, pDTTInfo);
                } else {
                    pCallback({});
                }
                pCurrentRow = {};
                new_data_json = {};
                old_data_json = {};
                strTempOldData = {};
                strTemp = {};
                strOldData = {};
                dtt_data_formats = [];
                str = {};
                objNewData = {};
                objTranDataRow = {};
                objNewRow = {};
                strAppID = '';
                strDTCode = '';
                strTargetTable = '';
                strKeyColumn = '';
                strDTDesc = '';
                strDTTDesc = '';
                strDTTCode = '';
            } catch (ex) {
                _TraceError(ex, pHeader, 'ERR-AUDITDATA-PRODUCER-0015', 'Catch Error in FindDTTInfo() Callback...');
                pCallback({});
                pCurrentRow = {};
                new_data_json = {};
                old_data_json = {};
                strTempOldData = {};
                strTemp = {};
                strOldData = {};
                dtt_data_formats = [];
                str = {};
                objNewData = {};
                objTranDataRow = {};
                objNewRow = {};
                strAppID = '';
                strDTCode = '';
                strTargetTable = '';
                strKeyColumn = '';
                strDTDesc = '';
                strDTTDesc = '';
                strDTTCode = '';
            }
        })
    } catch (ex) {
        _TraceError(ex, pHeader, 'ERR-AUDITDATA-PRODUCER-0016', 'Catch Error in _PrepareMessage()...');
        // Preparing array for solr insert failed data...
        pArrParsingFailedData.push(pCurrentRow.id);
        pCallback({});
        pCurrentRow = {};
        new_data_json = {};
        old_data_json = {};
        strTempOldData = {};
        strTemp = {};
        strOldData = {};
        dtt_data_formats = [];
        str = {};
        objNewData = {};
        objTranDataRow = {};
        objNewRow = {};
        strAppID = '';
        strDTCode = '';
        strTargetTable = '';
        strKeyColumn = '';
        strDTDesc = '';
        strDTTDesc = '';
        strDTTCode = '';
    }
}

function PrepareProduceTranNfxCoreData(params, PrepareProduceTranNfxCoreData) {
    var PrepareTranCoreDataInfo = {};
    var objLogInfo = {};
    var producerInfo = {};
    var topic_name = '';
    var key_column = '';
    var newJsonData = {};
    var DTInfo = {};
    var RelationJson = {};
    /*  params should contains
         - objLogInfo
         - hst_tran_json
         - key_column
         - DTInfo
         - topic_name
         - producerInfo */
    try {
        objLogInfo = params.objLogInfo || null;
        producerInfo = params.producerInfo || null;
        topic_name = params.topic_name || null;
        key_column = params.key_column || null;
        DTInfo = params.DTInfo || null;
        RelationJson = DTInfo['RELATION'];
        newJsonData = params.hst_tran_json;
        if (key_column) {
            // Adding Tran Core Unique ID
            newJsonData.TC_ID = newJsonData.DTT_CODE + ' - ' + newJsonData[key_column.toUpperCase()]
        }
        console.log(JSON.stringify(newJsonData));
        // reqProducer.ProduceMessage(topic_name, newJsonData, null, function (res) {
        if (key_column) {
            // Adding Tran Core Unique ID
            delete newJsonData.TC_ID;
            delete newJsonData.Key_Value;
        }
        PrepareTranCoreDataInfo.status = 'SUCCESS';
        PrepareProduceTranNfxCoreData(PrepareTranCoreDataInfo);
        PrepareTranCoreDataInfo = {};
        objLogInfo = {};
        producerInfo = {};
        topic_name = '';
        key_column = '';
        newJsonData = {};
        DTInfo = {};
        RelationJson = {};
        // });
    } catch (error) {
        PrepareTranCoreDataInfo.status = 'FAILURE';
        PrepareTranCoreDataInfo.errorObj = error;
        PrepareTranCoreDataInfo.errorInfo = 'Catch Error in PrepareTranCoreData()....';
        PrepareProduceTranNfxCoreData(PrepareTranCoreDataInfo);
        PrepareTranCoreDataInfo = {};
        objLogInfo = {};
        producerInfo = {};
        topic_name = '';
        key_column = '';
        newJsonData = {};
        DTInfo = {};
        RelationJson = {};
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
        _TraceError(error, pHeader, 'ERR-AUDITDATA-PRODUCER-0020', 'Catch Error in _objKeyToUpperCase()...');
    }
}



// To print error messages
function _TraceError(pErrorObj, pHeader, pErrorCode, pErrInfoMesg) {
    try {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, pErrorCode, pErrInfoMesg, pErrorObj);
    }
    catch (e) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-AUDITDATA-PRODUCER-0002', 'Catch Error in _TraceError();...', e);
    }
}

// To print log info messages
function _TraceInfo(pMsg) {
    reqInstanceHelper.PrintInfo(serviceName, pMsg, objLogInfo);
}



module.exports = {
    InitiateThread: initiateThread,
    _objKeyToUpperCase: _objKeyToUpperCase,
    _PrepareAndSaveKafkaMsg: _PrepareAndSaveKafkaMsg,
    PrepareProduceTranNfxCoreData: PrepareProduceTranNfxCoreData
}
/******** End of File **********/