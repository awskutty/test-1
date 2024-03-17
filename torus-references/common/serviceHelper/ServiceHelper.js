/****
 * Created by Shanthi on 7/1/2016.
 * Description : parse the dt relation_json - common function
 ****/

// Require dependencies
var reqFXDBInstance = require('../../instance/DBInstance');
var reqInsHelper = require('../../common/InstanceHelper');
var reqTRNDBInstance = require('../../instance/TranDBInstance');
var reqDateFormater = require('../../common/dateconverter/DateFormatter');
var RptInstance = require('../../instance/ReportInstance');
var reqasync = require('async');
var _ = require('lodash');
var request = require('request')
var serviceName = 'SeriveHelper'
function GetRelationJSON(pDTINFO) {
    var REL_JSON = {};
    var arrRelJson = [];
    try {
        if (pDTINFO.rows.length > 0)
            for (var i = 0; i < pDTINFO.rows.length; i++) {
                var relJson = pDTINFO.rows[0].relation_json;
                var jarrRel = JSON.parse(relJson);
                for (var i = 0; i < jarrRel.length; i++)
                    arrRelJson[i] = jarrRel[i];
                REL_JSON = arrRelJson;
            }
    } catch (ex) { }
    return REL_JSON;
}

function GetKeyColumn(pCasIns, pAppId, pDTCode, pDTTCode, pLogInfo, pCallback) {
    var objCallbak = {};
    try {
        const DTINFO = 'SELECT RELATION_JSON FROM DT_INFO WHERE APP_ID=? AND DT_CODE=? ;';
        reqFXDBInstance.GetTableFromFXDB(pCasIns, 'DT_INFO', ['RELATION_JSON'], {
            'APP_ID': pAppId,
            'DT_CODE': pDTCode
        }, pLogInfo, function callback(pError, pResult) {
            if (pError) {
                var objCallbak = _PrepareCallbackObject('FAILURE', '', 'ERR-HAN-40161', 'Error on GetKeyColumn()', pError, null);
                return pCallback(objCallbak);
            } else {
                if (pResult.rows.length > 0) {
                    var strRelationJson = pResult.rows[0]['relation_json'];
                    var tmpstr = GetTargetTableAndKeyColumn(JSON.parse(strRelationJson), pDTTCode, pLogInfo);
                    return pCallback(tmpstr);
                }
            }
        });
    } catch (error) {
        objCallbak = _PrepareCallbackObject('FAILURE', '', 'ERR-HAN-40162', 'Error on GetKeyColumn()', error, null);
        return pCallback(objCallbak);
    }
}

function GetTargetTableAndKeyColumn(pRelationJson, pDTTCode, pLogInfo) {
    var tmpStr = '';
    for (var j = 0; j < pRelationJson.length; j++) {
        tmpStr = _GetHierarchyDTT(pRelationJson[j], pDTTCode, pLogInfo);
        if (tmpStr != undefined && tmpStr.Status == 'SUCCESS') {
            if (tmpStr.Data != undefined && tmpStr.Data != null && tmpStr.Data != '')
                break;
        }
        if (tmpStr != undefined && tmpStr.Status == 'FAILURE') // if error in _GetHierarchyDTT()
            break;

    }
    return tmpStr;
}

function _GetHierarchyDTT(pRelationJson, pDTTCode, pLogInfo) {
    var obj = {};
    try {
        var objRelationJson = pRelationJson;
        var strTargetTable = '';
        var strKeyColumn = '';
        var strDTTDescription = '';
        var strDTTCategory = '';
        // Find targettable and keycolumn for selected DTTCode
        if (objRelationJson.DTT_CODE == pDTTCode) {
            strTargetTable = objRelationJson['TARGET_TABLE'];
            strKeyColumn = objRelationJson['PRIMARY_COLUMN'];
            strDTTDescription = objRelationJson['DTT_DESCRIPTION'];
            strDTTCategory = objRelationJson['CATEGORY'];
            var strDTTInfo = strTargetTable + ',' + strKeyColumn + ',' + strDTTDescription + ',' + strDTTCategory;
            //return strTargetTable + ',' + strKeyColumn + ',' + strDTTDescription + ',' + strDTTCategory
            obj = _PrepareCallbackObject('SUCCESS', strDTTInfo, '', '', null, null);
            return obj;
        }

        // find on child dtt relation
        for (var i = 0; i < objRelationJson.CHILD_DTT_RELEATIONS.length; i++) {
            var rtn = _GetHierarchyDTT(objRelationJson.CHILD_DTT_RELEATIONS[i], pDTTCode, pLogInfo);
            if (rtn != null)
                return rtn;
        }
    } catch (error) {
        obj = _PrepareCallbackObject('FAILURE', '', 'ERR-HAN-40163', 'Error on _GetHierarchyDTT()', error, null);
        return obj;
    }
}

function SendMail(pDepCas, pOTPSMSTemplate, pOTPMailTemplate, pData, pType, pLogInfo, pHeader, pInputParam, pCallback) {
    var strOTPSMSTemplate = '';
    var strOTPMAILTemplate = '';
    try {

        if (pOTPSMSTemplate != '')
            strOTPSMSTemplate = pOTPSMSTemplate;

        if (pOTPMailTemplate != '')
            strOTPMAILTemplate = pOTPMailTemplate;

        var strEmailID = (pInputParam.SessionInfo.USER_EMAIL != undefined && pInputParam.SessionInfo.USER_EMAIL != null) ? pInputParam.SessionInfo.USER_EMAIL : '';
        var strMobileNo = (pInputParam.SessionInfo.USER_MOBILE != undefined && pInputParam.SessionInfo.USER_MOBILE != null) ? pInputParam.SessionInfo.USER_MOBILE : '';

        _PrepareMsgData(pDepCas, strOTPSMSTemplate, strOTPMAILTemplate, pType, pLogInfo, function callbackPrepareMsgData(pTemplates) {
            var reqSendMsg = require('../../communication/core/SendMessage');
            var objMsgTemplts = pTemplates;
            if (objMsgTemplts.length > 0) {
                for (var j = 0; j < objMsgTemplts.length; j++) {
                    var objMsgTemp = objMsgTemplts[j];
                    if (objMsgTemp.CATEGORY_INFO.COMMC_CONFIG.CONFIG.TYPE.toUpperCase() == "MAIL") {
                        reqSendMsg.SendMessage(pHeader, pInputParam, objMsgTemp, pData, strEmailID, strMobileNo, pLogInfo, function callback() {
                            pCallback('SUCCESS');
                        });
                    }
                }
            } else
                pCallback('SUCCESS');
        });

    } catch (ex) {
        _PrintError(pLogInfo, 'Error while Sending OTP ', 'ERR-FX-10508', ex);
    }
}

function ParseSelectedTran(pLstTran, pSelectedTran, pUsername, pEmailId) {
    for (var i = 0; i < pSelectedTran.length; i++) {
        var dr = pSelectedTran[i];
        var objTran = {};
        Object.keys(dr).forEach(function (col) {
            objTran[col.toString().toLowerCase()] = dr[col];
        });
        objTran['user_name'] = pUsername;
        objTran['email_id'] = pEmailId;
        pLstTran.push(objTran);
    }

}

function _PrepareMsgData(pDepCas, pOTPSMSTemp, pOTPMailTemp, pType, pLogInfo, pCallback) {
    var objMsgTemplts = [];
    var authenticationmodel = 'MAIL';
    try {
        if (authenticationmodel == 'MAIL')
            pOTPSMSTemp = "";
        else if (authenticationmodel == 'SMS')
            pOTPMailTemp = "";

        _GetCommMsgTemplate(pDepCas, pOTPSMSTemp, pOTPMailTemp, pLogInfo, function callbackGetCommMsgTemplate(pTemplates) {
            var lstComm = pTemplates;

            if (lstComm == undefined || lstComm === null || lstComm.length == 0) {
                _PrintError(pLogInfo, 'Communication info setup is Missing', 'ERR-FX-10514', null);
            } else {
                for (var i = 0; i < lstComm.length; i++) {
                    var rw = lstComm[i];
                    var objMsgTemplt = {};
                    objMsgTemplt.CATEGORY_INFO = JSON.parse(rw['category_info']);
                    objMsgTemplt.TEMPLATE_INFO = JSON.parse(rw['template_info']);
                    objMsgTemplt.ATTACHMENTs = [];
                    if (pType == 'DELETE_CONTENT')
                        objMsgTemplt.CONTACT_INFOs = JSON.parse(rw['contact_info']);
                    else {
                        var TOC = [{
                            ADDRESS_TYPE: 'TO',
                            COLUMN_NAME: 'email_id',
                            STATIC_ADDRESS: ''
                        }];
                        objMsgTemplt.CONTACT_INFOs = TOC;
                    }
                    objMsgTemplts.push(objMsgTemplt);
                }
            }
            pCallback(objMsgTemplts);
        });
    } catch (ex) {
        _PrintError(pLogInfo, "Error while preparing communication message templates - __PrepareMsgData() ", 'ERR-FX-10513', ex);
    }
    return objMsgTemplts;
}

function _GetCommMsgTemplate(pDepCas, pOTPSMSTemp, pOTPMailTemp, pLogInfo, pCallback) {
    var lstComm = [];
    var COMMINFO = "SELECT * FROM COMM_INFO WHERE APP_ID = '0' AND WFTPA_ID= 'DEFAULT' AND  EVENT_CODE='DEFAULT' AND DT_CODE= 'DEFAULT' AND  DTT_CODE = 'DEFAULT' AND  COMMMT_CODE = ? ALLOW FILTERING ;";
    if (pOTPSMSTemp != '' && pOTPMailTemp == "")
        reqFXDBInstance.GetTableFromFXDB(pDepCas, 'COMM_INFO', [], {
            'APP_ID': '0',
            'WFTPA_ID': 'DEFAULT',
            'EVENT_CODE': 'DEFAULT',
            'DT_CODE': 'DEFAULT',
            'DTT_CODE': 'DEFAULT',
            'COMMMT_CODE': pOTPSMSTemp
        }, pLogInfo, function callbackGetCommInfo(pError, pResult) {
            if (pError)
                _PrintError(pLogInfo, 'Error on querying COMM_INFO table', 'ERR-DB-50001', pError);
            else if (pResult) {
                lstComm = pResult.rows;
            }
            pCallback(lstComm);
        });
    else if (pOTPMailTemp != '' && pOTPSMSTemp == '')
        reqFXDBInstance.GetTableFromFXDB(pDepCas, 'COMM_INFO', [], {
            'APP_ID': '0',
            'WFTPA_ID': 'DEFAULT',
            'EVENT_CODE': 'DEFAULT',
            'DT_CODE': 'DEFAULT',
            'DTT_CODE': 'DEFAULT',
            'COMMMT_CODE': pOTPMailTemp
        }, pLogInfo, function callbackGetCommInfo(pError, pResult) {
            // pDepCas.execute(COMMINFO, [pOTPMailTemp], {
            //     prepare: true
            // }, function callbackGetCommInfo(pError, pResult) {
            if (pError)
                _PrintError(pLogInfo, 'Error on execute query on COMM_INFO ', 'ERR-DB-50001', pError);
            else if (pResult) {
                lstComm = pResult.rows;
            }
            pCallback(lstComm);
        });
}


function _PrintError(pLogInfo, pMessage, pErrorCode, pError) {
    reqInsHelper.PrintError('ServiceHelper', pLogInfo, pErrorCode, pMessage, pError);
}

function _printInfo(serviceName, pLogInfo, pMessage) {
    reqInsHelper.PrintInfo(serviceName, pMessage, pLogInfo);
}

// Prepare callback object
function _PrepareCallbackObject(pStatus, pData, pErrorCode, pErrMsg, pError, pWarning) {
    var objCallback = {
        Status: pStatus,
        Data: pData,
        ErrorCode: pErrorCode,
        ErrorMsg: pErrMsg,
        Error: pError,
        Warning: pWarning
    };
    return objCallback;
}

// This Method can be Used to Get Data from Table Dynamically
function GetDataByFilterAndTable(pReqObj, GetDataByFilterAndTableCB) {
    /* pReqObj Should Contains
    - Table_Name
    - Db_Condition_Obj  
    - objLogInfo
    - FXDB_Connection
    - Required_Columns
    */
    try {
        var tableName = pReqObj.Table_Name;
        var condObj = pReqObj.Db_Condition_Obj;
        var objLogInfo = pReqObj.objLogInfo;
        var fxdbConnection = pReqObj.FXDB_Connection;
        var requiredColumns = pReqObj.Required_Columns || [];
        reqFXDBInstance.GetTableFromFXDB(fxdbConnection, tableName, requiredColumns, condObj, objLogInfo, function (error, pRes) {
            GetDataByFilterAndTableCB(error, pRes);
        });
    } catch (error) {
        GetDataByFilterAndTableCB(error, null);
    }
}

function GetHierarchyParent(pReqObj) {
    /* pReqObj should contains
    - resultRows 
    - curParentSID [Actually its a System ID]
    - resultSId []*/
    try {
        var resultRows = pReqObj.resultRows || [];
        var curParentSID = pReqObj.curParentSID || null;
        var arrParentResultInfo = pReqObj.resultSId || [];
        // Add current Parent STS ID
        // arrParentResultInfo.push(curParentSID);
        for (var i = 0; i < resultRows.length; i++) {
            if (curParentSID == resultRows[i].s_id) {
                arrParentResultInfo.push(resultRows[i]);
                pReqObj.resultSId = arrParentResultInfo;
                pReqObj.curParentSID = resultRows[i]['parent_s_id'];
                if (pReqObj.curParentSID !== "0") {
                    return GetHierarchyParent(pReqObj);
                } else {
                    continue;
                }
            }
        }
        return arrParentResultInfo;
    } catch (error) {
        return arrParentResultInfo;
    }
}



// GetSetupJson from specified table

function GetSetupJson(pCltClient, cond, objLogInfo, pcallback) {
    _printInfo('GetSetupJson', objLogInfo, 'GetSetupJson function called');
    var sortRes = [];
    if (cond.TenatId) {
        objLogInfo.TENANT_ID = cond.TenatId;
        delete cond.TenatId;
    }

    reqFXDBInstance.GetTableFromFXDB(pCltClient, 'FX_SETUP_MASTER', [], cond, objLogInfo, function (err, Res) {
        try {
            var resRows = [];
            if (err) {
                var callbackRes = _PrepareCallbackObject('FAILURE', '', 'ERR-MIN-50628', 'Error occured while get  SETUP_MASTER_OVERRIDE table value', err, null);
                return pcallback(callbackRes);
            } else {
                reqasync.forEachOfSeries(Res.rows, function (pRow, indx, asycallback) {
                    var overRideJsonVal = JSON.parse(pRow.override_json);
                    sortRes = _.sortBy(overRideJsonVal, ['sort_order']);
                    _Getsetvalue(pRow.setup_code, sortRes, objLogInfo, function (res) {
                        _printInfo('GetSetupJson', objLogInfo, JSON.stringify(res));
                        if (res.Status == 'SUCCESS' && res.Data.length) {
                            resRows.push(res.Data[0]);
                        }
                        asycallback();
                    });
                }, function (error) {
                    if (error) {
                        var callbackRes = _PrepareCallbackObject('FAILURE', '', 'ERR-MIN-50629', 'Exception occured while execute _Getsetvalue function', error, null);
                        return pcallback(callbackRes);
                    } else {
                        var callbackRes = _PrepareCallbackObject('SUCCESS', resRows, '', '', null, null);
                        return pcallback(callbackRes);
                    }
                });

            }
        } catch (error) {
            var callbackRes = _PrepareCallbackObject('FAILURE', '', 'ERR-MIN-50629', 'Exception occured while execute _Getsetvalue function', error, null);
            return pcallback(callbackRes);
        }
    });

    function _Getsetvalue(pSetupCode, pRows, objLogInfo, loopcallback) {
        try {
            _printInfo('GetSetupJson', objLogInfo, '_Getsetvalue function called');
            var setupRows = [];
            reqasync.forEachOfSeries(pRows, function (pRow, indx, callback) {
                // var pCond = JSON.parse(pRow.condition_json);
                var pCond = _getSetupwhereCondition(pRow.table_name, objLogInfo);

                if (pRow.table_name.toUpperCase() == 'TENANT_SETUP') {
                    pCond.CATEGORY = pSetupCode;
                } else {
                    pCond.setup_code = pSetupCode;
                }

                _printInfo('GetSetupJson', objLogInfo, JSON.stringify(pCond));

                reqFXDBInstance.GetTableFromFXDB(pCltClient, pRow.table_name, [], pCond, objLogInfo, function (pErr, pRes) {
                    if (pErr) {
                        var callbackRes = _PrepareCallbackObject('FAILURE', '', 'ERR-MIN-50629', 'Error occured while get table value', pErr, null);
                        return pcallback(callbackRes);
                    } else {
                        if (pRes.rows.length) {
                            setupRows.push(pRes.rows[0]);
                            callback();
                        } else {
                            callback();
                        }
                    }
                });
            }, function (error) {
                if (error) {
                    var callbackRes = _PrepareCallbackObject('FAILURE', '', 'ERR-MIN-50629', 'Error occured while get table value', pErr, null);
                    return loopcallback(callbackRes);
                } else {
                    // _printInfo('GetSetupJson', objLogInfo, '_Getsetvalue callback called');
                    // var callbackRes = _PrepareCallbackObject('SUCCESS', setupRows, '', '', null, null);
                    var resdata = {
                        Status: 'SUCCESS',
                        Data: setupRows
                    };
                    return loopcallback(resdata);
                }
            });
        } catch (error) {
            var callbackRes = _PrepareCallbackObject('FAILURE', [], 'ERR-MIN-50639', 'Exception occured while execute _Getsetvalue function', error, null);
            return pcallback(callbackRes);
        }
    }


    function _getSetupwhereCondition(pTableName, objLogInfo) {
        var cond = {};
        if (pTableName.toUpperCase() == 'APPLICATION_SETUP') {
            cond.APP_ID = objLogInfo.APP_ID;
        } else if (pTableName.toUpperCase() == 'SYSTEM_SETUP') {
            cond.S_ID = objLogInfo.S_ID;
        } else if (pTableName.toUpperCase() == 'SYSTEM_TYPE_SETUP') {
            cond.ST_ID = objLogInfo.ST_ID;
        } else if (pTableName.toUpperCase() == 'TORUS_PLATFORM_SETUP') {
            // ?
        } else if (pTableName.toUpperCase() == 'TENANT_SETUP') {
            cond.TENANT_ID = objLogInfo.TENANT_ID || '0';
        }
        return cond;
    }
}


// Get LICENSE_INFO from Redis
function GetLicenseSetup(pLogInfo, pReq, pcallback) {
    try {
        _printInfo('GetLicenseSetup', pLogInfo, 'Getting license setup | ' + pReq.type);
        if (pLogInfo.TENANT_ID == '0' && pLogInfo.LOGIN_NAME.toUpperCase() == "TORUS_ADMIN") {
            // TORUS_ADMIN user and tenant id "0" no need to validate the license setup
            var callbackRes = _PrepareCallbackObject('SUCCESS', 'SKIP_LICENSE_VERIFICATION', '', '', '', null);
            return pcallback(callbackRes);
        } else {
            reqInsHelper.GetConfig('LICENSE_INFO', function (res) {
                if (res) {
                    _printInfo('GetLicenseSetup', pLogInfo, 'LICENSE_INFO key available');
                    var setupJSon = JSON.parse(res);
                    var filteredSetup = setupJSon.TENANT.filter(setup => setup.TENANT_ID.toUpperCase() == pLogInfo.TENANT_ID.toUpperCase());
                    var resSetup;
                    if (filteredSetup.length) {
                        if (pReq.type == 'APP') {
                            resSetup = filteredSetup[0].SETUP[pReq.type].filter(app => app.APP_ID == pLogInfo.APP_ID);
                        } else if (pReq.type == "SYSTEM_TYPE") {
                            resSetup = filteredSetup[0].SETUP[pReq.type].filter(sType => sType.ST_CODE == pReq.stCode);
                        } else {
                            _printInfo('GetLicenseSetup', pLogInfo, 'Requested license setup code not available | ' + pReq.type);
                            var callbackRes = _PrepareCallbackObject('FAILURE', '', '404', '', 'License setup not found. Please contact system administrator.', null);
                            return pcallback(callbackRes);
                        }
                        if (resSetup.length) {
                            var callbackRes = _PrepareCallbackObject('SUCCESS', resSetup[0], '', '', null, null);
                            return pcallback(callbackRes);
                        } else {
                            _printInfo('GetLicenseSetup', pLogInfo, 'License setup not found | ' + pReq.type);
                            var callbackRes = _PrepareCallbackObject('FAILURE', '', '404', '', 'License setup not found. Please contact system administrator.', null);
                            return pcallback(callbackRes);
                        }
                    } else {
                        _printInfo('GetLicenseSetup', pLogInfo, 'License setup not found for tenant | ' + pLogInfo.TENANT_ID);
                        var callbackRes = _PrepareCallbackObject('FAILURE', '', '404', '', 'License setup not found. Please contact system administrator.', null);
                        return pcallback(callbackRes);
                    }
                } else {
                    // var callbackRes = _PrepareCallbackObject('FAILURE', '', '404', '', 'License setup not found. Please contact system administrator.', null);
                    var callbackRes = _PrepareCallbackObject('SUCCESS', 'SKIP_LICENSE_VERIFICATION', '', '', '', null);
                    return pcallback(callbackRes);
                }
            });
        }
    } catch (error) {
        var callbackRes = _PrepareCallbackObject('FAILURE', '', 'ERR-SVCH-50629', 'Exception occured while get licenseInfo', error, null);
        return pcallback(callbackRes);
    }
};

// Force Logout
function ReleaseTranLocks(pHeader, CltSession, reqObj, appRequest, appResponse, objLogInfo, pcallback) {
    try {
        var objCond = {};
        objCond.LOCKED_BY = reqObj.U_ID;
        var updatecolumn = {
            LOCKED_BY: '',
            LOCKED_BY_NAME: ''
        }
        var updatecond = {
            LOCKED_BY: reqObj.U_ID,
        }
        reqTRNDBInstance.GetTranDBConn(pHeader, false, function (DBSession) {
            // Update the TRANSACTION_SET For Clear the session LOCKED BY AND LOCKED BY NAME COLUMN
            reqTRNDBInstance.UpdateTranDBWithAudit(DBSession, 'TRANSACTION_SET', updatecolumn, updatecond, objLogInfo, function (result, pError) {
                if (pError) {
                    var callbackRes = _PrepareCallbackObject('FAILURE', '', 'ERR-MIN-50601', 'Update error in TRANSACTION_SET', pError, null);
                    return pcallback(callbackRes);
                } else {
                    try {
                        var objCond = {};
                        objCond.U_ID = reqObj.U_ID;
                        // Query the USER_SESSIONS table for get the selected user session id and logip column values
                        reqFXDBInstance.GetTableFromFXDB(CltSession, 'USER_SESSIONS', [], objCond, objLogInfo, function (error, result) {
                            try {
                                if (error) {
                                    var callbackRes = _PrepareCallbackObject('FAILURE', '', 'ERR-MIN-50602', 'ERROR IN GET USER SESSION TABLE', error, null);
                                    return pcallback(callbackRes);
                                } else {
                                    if (result.rows.length > 0) {
                                        reqObj.SESSION_ID = result.rows[0].session_id
                                        Logout(pHeader, CltSession, reqObj, appRequest, appResponse, objLogInfo, function (res) {
                                            pcallback(res)
                                        })
                                    } else {
                                        pcallback(_PrepareCallbackObject(serviceName, 'SUCCESS', '', '', ''))
                                    }
                                }
                            } catch (error) {
                                pcallback(_PrepareCallbackObject(serviceName, '', 'ERR-MIN-50607', 'Exception occured GetTableFromFXDB() function ', error))
                            }
                        })
                    } catch (error) {
                        pcallback(_PrepareCallbackObject(serviceName, '', 'ERR-MIN-50608', 'Exception occured GetFXDBConnection() function', error))
                    }
                }
            })

        })
    } catch (error) {
        pcallback(_PrepareCallbackObject(serviceName, '', 'ERR-MIN-50610', 'Exception occured GetTranDBConn() function ', error))
    }
}

function Logout(pheaders, mClient, reqObj, appRequest, appResponse, objLogInfo, finalcallback) {
    try {
        var reqRedisInstance = require('../../instance/RedisInstance');
        updateLockedDate(finalcallback, function (response) {
            try {
                if (response == 'SUCCESS') {
                    _printInfo(serviceName, objLogInfo, 'DeleteFXDB user_sessions executing...');
                    reqFXDBInstance.DeleteFXDB(mClient, 'user_sessions', {
                        'u_id': reqObj.U_ID
                    }, objLogInfo, function callbackUserSession(err) {
                        try {
                            if (err) {
                                finalcallback(_PrepareCallbackObject("FAILURE", '', 'ERR-AUT-10605', 'DeleteFXDB from user_sessions failed', err, ''))
                            } else {
                                strResult = 'SUCCESS';
                                _printInfo(serviceName, objLogInfo, 'Session cleared successfully from user_sessions table.');
                                var rediskey = 'SESSIONID-' + reqObj.SESSION_ID;
                                _printInfo(serviceName, objLogInfo, 'Delete Redis Key session info executing...');

                                // delete session info from  redis 
                                reqRedisInstance.GetRedisConnection(function (error, clientR) {
                                    if (error) {
                                        finalcallback(_PrepareCallbackObject("FAILURE", '', 'ERR-AUT-10609', ' Deleteing  Redis session  failed ', error));
                                    } else {
                                        reqRedisInstance.GetRedisConnectionwithIndex(2, async function (error, RedisSession) {
                                            if (error) {
                                                finalcallback(_PrepareCallbackObject("FAILURE", '', 'ERR-AUT-10606', ' Deleteing  Redis session  failed ', err));
                                            } else {
                                                try {
                                                    // RedisSession.del(rediskey, function (err, reply) {
                                                    await RedisSession.del(rediskey)
                                                    if (err) {
                                                        finalcallback(_PrepareCallbackObject("FAILURE", '', 'ERR-AUT-10606', ' Deleteing  Redis session  failed ', err));
                                                    } else {
                                                        // reqInstanceHelper.PrintInfo(serviceName, 'Redis Session ID Cleared. Redis SessionID is :' + rediskey, objLogInfo);
                                                        // reqInstanceHelper.PrintInfo(serviceName, rediskey + 'Session value deleted from  redis', objLogInfo);
                                                        _printInfo(serviceName, objLogInfo, 'Redis Session ID Cleared. Redis SessionID is :' + rediskey);
                                                        _printInfo(serviceName, objLogInfo, rediskey + 'Session value deleted from  redis');
                                                        updateHstUsersession(function () {
                                                            if (reqObj.NeedextrAuth && reqObj.NeedextrAuth == "Y") {
                                                                try {
                                                                    _printInfo(serviceName, objLogInfo, 'Block chain auth available, call block logout ');
                                                                    PrepareResultStr(strResult, function (res) {
                                                                        _printInfo(serviceName, objLogInfo, 'Block chain  logout finished ');
                                                                        finalcallback(res);
                                                                    });
                                                                    clientR.get('EXTERNAL_AUTH_INFO_' + objLogInfo.headers.routingkey, function (err, Info) {
                                                                        try {
                                                                            var HYPER_LEDGER_INFO = JSON.parse(Info).HYPER_LEDGER;
                                                                            var apiurl = HYPER_LEDGER_INFO.API_URL;
                                                                            var LogoutOptions = {
                                                                                method: 'GET',
                                                                                url: apiurl + 'auth/logout',
                                                                                headers: {
                                                                                    'X-Access-Token': accessToken
                                                                                }
                                                                            };
                                                                            //Logout request call     
                                                                            request(LogoutOptions, function (error, response, body) {
                                                                                try {
                                                                                    if (error) {
                                                                                        reqInstanceHelper.PrintInfo(serviceName, 'Error occured while call logout ext auth ' + error, objLogInfo);
                                                                                    }
                                                                                    jasperserverlogoff(function () {
                                                                                        PrepareResultStr(strResult, function (res) {
                                                                                            reqInstanceHelper.PrintInfo(serviceName, 'Block chain  logout finished ', objLogInfo);
                                                                                            finalcallback(res);
                                                                                        });
                                                                                    })
                                                                                } catch (error) {
                                                                                    finalcallback(_PrepareCallbackObject('FAILURE', '', 'ERR-AUT-10611', 'Exception Occured While Logout from Hyper', error));
                                                                                }
                                                                            });
                                                                        } catch (error) {
                                                                            finalcallback(_PrepareCallbackObject('FAILURE', '', 'ERR-AUT-10612', 'Exception Occured While Logout from Hyper', error));
                                                                        }
                                                                    });
                                                                } catch (error) {
                                                                    finalcallback(_PrepareCallbackObject('FAILURE', '', 'ERR-AUT-10610', 'Exception Occured While Logout from Hyper', error));
                                                                }
                                                            } else {
                                                                //jasper logout
                                                                jasperserverlogoff(function () {
                                                                    PrepareResultStr(strResult, function (res) {
                                                                        finalcallback(res);
                                                                    });
                                                                })
                                                            }

                                                        });
                                                    }
                                                    // });
                                                } catch (error) {
                                                    finalcallback(_PrepareCallbackObject('FAILURE', '', 'ERR-AUT-10608', 'Exception Occured While Delete key from redis ', error));
                                                }


                                            }
                                        });
                                    }
                                });
                            }
                        } catch (error) {
                            finalcallback(_PrepareCallbackObject('FAILURE', '', 'ERR-AUT-10601', 'Exception Occured While callbackUserSession function  ', error));
                        }
                    });
                }

            } catch (error) {
                finalcallback(_PrepareCallbackObject('FAILURE', '', 'ERR-AUT-106020', 'Exception Occured While callbackUserSession function  ', response.Error));
            }
        });


        function updateHstUsersession(pcallback) {
            try {
                var updatehstobj = {
                    logout_time: reqDateFormater.GetTenantCurrentDateTime(pheaders, objLogInfo),
                    logout_mode: reqObj.Logout_Mode,
                    modified_by: reqObj.loginName,
                    modified_date: reqDateFormater.GetTenantCurrentDateTime(pheaders, objLogInfo),
                    modified_tz: objLogInfo.CLIENTTZ,
                    modified_tz_offset: objLogInfo.CLIENTTZ_OFFSET
                };

                reqFXDBInstance.UpdateFXDB(mClient, 'hst_user_sessions', updatehstobj, {
                    'u_id': reqObj.U_ID,
                    'session_id': reqObj.SESSION_ID
                }, objLogInfo, function (err) {
                    try {
                        if (err) {
                            finalcallback(_PrepareCallbackObject("FAILURE", '', 'ERR-AUT-106028', ' UpdateFXDB from hst_user_session failed and  session Not Found ', err));
                        } else {
                            pcallback();
                        }
                    } catch (error) {
                        finalcallback(_PrepareCallbackObject('FAILURE', '', 'ERR-AUT-106030', 'Exception Occured While UpdateFXDB function  ', error));
                    }
                });
            } catch (error) {
                finalcallback(_PrepareCallbackObject('FAILURE', '', 'ERR-AUT-106029', 'Exception Occured While update hst_user_session table  ', error));
            }
        }

        function updateLockedDate(finalcallback, updatecallback) {
            try {
                var updateobj = {
                    account_locked_date: null
                };
                reqFXDBInstance.UpdateFXDB(mClient, 'users', updateobj, {
                    'u_id': reqObj.U_ID
                }, objLogInfo, function (err) {
                    try {
                        if (err) {
                            finalcallback(_PrepareCallbackObject("FAILURE", '', 'ERR-AUT-106022', ' UpdateFXDB from user failed and  User Not Found ', err))
                        } else {
                            strResult = 'SUCCESS';
                            _printInfo(serviceName, objLogInfo, 'Updated Successfully in USERS.')
                            updatecallback(strResult);
                        }
                    } catch (error) {
                        finalcallback(_PrepareCallbackObject('FAILURE', '', 'ERR-AUT-106023', 'Exception Occured While UpdateFXDB function  ', error));
                    }
                });
            } catch (error) {
                finalcallback(_PrepareCallbackObject('FAILURE', '', 'ERR-AUT-106021', 'Exception Occured While updateLockedDate function  ', error));
            }

        }
        // FInal Result preparation
        function PrepareResultStr(pMessage, callback) {
            try {
                _printInfo(serviceName, objLogInfo, 'PrepareResultStr function executing...');
                callback(_PrepareCallbackObject('SUCCESS', 'SUCCESS', '', '', '', ''));
            } catch (error) {
                callback(_PrepareCallbackObject('FAILURE', '', 'ERR-AUT-10602', 'Exception Occured While PrepareResultStr function  ', error));
            }
        }


        function jasperserverlogoff(pcallback) {
            try {
                _printInfo(serviceName, objLogInfo, 'Jasper cookie available. Going to prepare jasperlogout url');
                RptInstance.GetReportConfig(pheaders, objLogInfo, function callbackGetReportConfig(pConfigStatus) {
                    try {
                        if (pConfigStatus.Status == 'SUCCESS') {
                            var strJasperServerInfo = typeof pConfigStatus.Data == 'string' ? JSON.parse(pConfigStatus.Data) : pConfigStatus.Data;
                            var strJSIPAddr = strJasperServerInfo['Server'] || strJasperServerInfo['SERVER'] || strJasperServerInfo['server'];
                            var strJSPort = strJasperServerInfo['Port'] || strJasperServerInfo['PORT'] || strJasperServerInfo['port'];
                            var url = "http://" + strJSIPAddr + ":" + strJSPort + "/jasperserver/logout.html";
                            _printInfo(serviceName, objLogInfo, 'Jasper logout url is ' + url);
                            var options = {
                                url: url,
                                method: 'GET',
                                "rejectUnauthorized": false,
                                headers: {
                                    "Cookie": appRequest.headers.cookie
                                }
                            };
                            request(options, function (error, response, body) {
                                try {
                                    if (error) {
                                        _printInfo(serviceName, objLogInfo, 'Error occured while call jasper logout. The error is ' + error);
                                        pcallback();
                                    } else {
                                        _printInfo(serviceName, objLogInfo, 'Jasper logout success and execute clear cookies');
                                        console.log("clearAllCookies called")
                                        var allCookies = appRequest.headers.cookie;
                                        if (allCookies) {
                                            allCookies = allCookies.split(";");
                                            for (var i = 0; i < allCookies.length; i++) {
                                                var cName = allCookies[i].split("=")[0];
                                                appResponse.clearCookie(cName);
                                            }
                                            pcallback()
                                        }
                                    }
                                } catch (error) {
                                    _printInfo(serviceName, objLogInfo, 'Exception occured  request function ' + error);
                                    pcallback();
                                }
                            });
                        } else {
                            _printInfo(serviceName, objLogInfo, 'Error occured while get Jasper server config ' + pConfigStatus.ErrorMsg);
                            pcallback();
                        }
                    } catch (error) {
                        _printInfo(serviceName, objLogInfo, 'Exception occured GetReportConfig ' + error);
                        pcallback();
                    }
                });
            } catch (error) {
                _printInfo(serviceName, objLogInfo, 'Exception occured jasperserverlogoff ' + error);
                pcallback();
            }
        }

        function clearAllCookies(pcallback) {
            console.log("clearAllCookies called")
            var allCookies = appRequest.headers.cookie;
            if (allCookies) {
                allCookies = allCookies.split(";");
                for (var i = 0; i < allCookies.length; i++) {
                    var cName = allCookies[i].split("=")[0];
                    appResponse.clearCookie(cName);
                }
                pcallback()
            }

        }
    } catch (error) {
        _printInfo(serviceName, objLogInfo, 'Exception occured Logout helper ' + error);
        pcallback();
    }
}



function getEncryptColumnDetails(pcltSession, strDTTCode, objLogInfo) {
    return new Promise((resolve, reject) => {
        try {
            reqInsHelper.PrintInfo(serviceName, 'Getting encrypted column values.', objLogInfo);
            var whereCond = {
                CATEGORY: "DTT_ENCRYPTED_COLUMN_INFO",
                TENANT_ID: objLogInfo.TENANT_ID
            }
            reqFXDBInstance.GetTableFromFXDB(pcltSession, 'TENANT_SETUP', [], whereCond, objLogInfo, function (perr, setupRow) {
                if (perr) {
                    reject(perr)
                } else {
                    var parsedmetadata = []
                    if (setupRow.rows.length) {
                        reqInsHelper.PrintInfo(serviceName, 'Got the setup.', objLogInfo);
                        if (setupRow.rows[0].setup_json && JSON.parse(setupRow.rows[0].setup_json).encryption_columns) {
                            parsedmetadata = JSON.parse(setupRow.rows[0].setup_json).encryption_columns;
                        }
                        var columnList = ''
                        for (var i = 0; i < parsedmetadata.length; i++) {
                            if (strDTTCode == parsedmetadata[i].dtt_code) {
                                columnList += parsedmetadata[i].column;
                                break;
                            }
                        }
                        if (columnList) {
                            columnList = columnList.split(',')
                        } else {
                            columnList = []
                        }
                        var finalres = []
                        for (var j = 0; j < columnList.length; j++) {
                            if (columnList[j]) {
                                finalres.push(columnList[j].trim())
                            }
                        }
                        reqInsHelper.PrintInfo(serviceName, finalres.length ? 'Encrypted column available' : 'Encrypted column not available', objLogInfo);

                        resolve(finalres);
                    } else {
                        reqInsHelper.PrintInfo(serviceName, 'Setup not found.', objLogInfo);
                        resolve([])
                    }
                }
            })
        } catch (error) {
            reject("Exception occured : " + error)
        }

    })
}

//This is the array ,which columns are required to decrypt the data
function checkNeedDecrypt(pColumn) {
    var decrypt_category = [
        "MAIL_SETUP",
        "SMS_SETUP",
        "EXG_PKI_STORE"
    ]
    var res = false
    if (decrypt_category.indexOf(pColumn) > -1) {
        res = true
    }
    return res
}

module.exports = {
    GetRelationJSON: GetRelationJSON,
    GetTargetTableAndKeyColumn: GetTargetTableAndKeyColumn,
    GetKeyColumn: GetKeyColumn,
    SendMail: SendMail,
    ParseSelectedTran: ParseSelectedTran,
    GetDataByFilterAndTable: GetDataByFilterAndTable,
    GetHierarchyParent: GetHierarchyParent,
    GetSetupJson: GetSetupJson,
    GetLicenseSetup: GetLicenseSetup,
    ReleaseTranLocks: ReleaseTranLocks,
    Logout: Logout,
    getEncryptColumnDetails: getEncryptColumnDetails,
    checkNeedDecrypt: checkNeedDecrypt

};