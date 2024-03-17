/*
 @Description      : To define report related common functions and maintain
 */

// Require dependencies
var modPath = '../../../../../node_modules/';
var refPath = '../../../../../torus-references/';
var reqExpress = require(modPath + 'express');
var reqAsync = require(modPath + 'async');
var Filehelper = require('./FileHelper');
var ServiceHelper = require('./ServiceHelper');
var tranDBInstance = require('../../../../../torus-references/instance/TranDBInstance');
var RptInstance = require('../../../../../torus-references/instance/ReportInstance');
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqFXDBInstance = require('../../../../../torus-references/instance/DBInstance');
var reqDateFormat = require(modPath + 'dateformat');
var reqDateFormatter = require('../../../../../torus-references/common/dateconverter/DateFormatter');
var reqLinq = require('node-linq').LINQ;
var request = require('request');
var path = require(modPath + 'path');
var fs = require("fs");
var router = reqExpress.Router();
var xml2js = require('xml2js');
var reqUuid = require('uuid');

var appstsrow = [];
var lstAppsts = [];
var mTranDB;
var mDepCas;
var mCltCas;
var mOrm = 'knex';

var UserID = "";
var strAppId = '';
var strAppName = "";
var strAppUId = "";
var strAppRoles = '';
var strUid = "";
var strLoginName = "";
var strSystemId = "";
var strSystemName = "";
var strSTSId = "";
var strClientId = "";
var strClusterCode = "";
var strAppSTSId = '';
var TokenID = "";
var strRptName = '';
var ARPTD_ID = '';
var parser = new xml2js.Parser();
var filewritepath = '';
var SubReportList = "";
var DirectoryName = '';
var arrChildSTSId = [];
var objLogInfo = '';
var response = '';
var _pHeaders = "";
var routingKey = '';
// To search report
function SearchReport(ClientParams, pSessionInfo, pReqHeader, pLogInfo, finalcallback) {


    routingKey = pReqHeader.routingkey.toUpperCase();
    objLogInfo = pLogInfo;

    SubReportList = "";
    var Criteria = "";
    var SrchParamValue = "";
    objLogInfo['report_path'] = ClientParams['RPT_PATH'] ? ClientParams['RPT_PATH'] : '';
    objLogInfo['DB_MODE'] = ClientParams['DB_MODE'] || ''
    _pHeaders = pReqHeader;
    try {
        _PrintInfo('Initializing DB ...');
        _InitializeDB(pReqHeader, function callbackInitializeDB(pStatus) {

            var AppuID = strAppUId;

            var Result = '';
            Filehelper.CreateTempDir(__dirname, 'Temp', function (PDirectoryStatus) {
                if (PDirectoryStatus.Status == 'SUCCESS') {
                    DirectoryName = PDirectoryStatus.Data;
                    _PrintInfo('Initializing the params ...');
                    __InitializeParams(ClientParams, pSessionInfo, function callbackInitializeParam(pInputStatus) {
                        if (pInputStatus.Status == 'SUCCESS') {
                            _PrintInfo('Preparing searchparam ...');
                            __PrepareSearchParam(ClientParams, function callbackPrepareSearchParam(pCriteria, pSrchParam, pstrSearch_info, pParamStatus) {
                                if (pParamStatus.Status == 'SUCCESS') {
                                    Criteria = pCriteria;

                                    _PrintInfo('Preparing the JasperServerUrl...');
                                    _GetJasperServerUrl(ARPTD_ID, AppuID, strRptName, Criteria, pSrchParam, pstrSearch_info, pReqHeader, function (Result) {
                                        if (Result) {
                                            _PrintInfo('Got result From _GetJasperServerUrl Function ');
                                            if (Result.Status == "SUCCESS") {
                                                var jasperAuth = Result.Data.JasperAuthurl;
                                                Result.Data = Result.Data.JasperSerUrl;
                                                if (objLogInfo.NEED_SYSTEM_ROUTING != 'Y' &&
                                                    _pHeaders.cookie && _pHeaders.cookie.indexOf('JSESSIONID') >= 0) {
                                                    finalcallback(Result);
                                                } else {
                                                    _authenticateJasper(jasperAuth, function (res) {
                                                        try {
                                                            Result.JasperAuth = res;
                                                            finalcallback(Result);
                                                        } catch (error) {
                                                            console.log('error ' + error);
                                                            return _PrepareAndSendCallback('FAILURE', null, 'ERR-RPT-60724', 'Exception occured _authenticateJasper', error, '', finalcallback);
                                                        }
                                                    });
                                                }
                                            } else {
                                                finalcallback(Result);
                                            }
                                        }
                                    });
                                } else // failed in preparing searchparam
                                    return _PrepareAndSendCallback(pParamStatus.Status, null, pParamStatus.ErrorCode, pParamStatus.ErrorMsg, pParamStatus.Error, pParamStatus.Warning, finalcallback);
                            });
                        } else // failed in Initialize input params
                            return _PrepareAndSendCallback(pInputStatus.Status, null, pInputStatus.ErrorCode, pInputStatus.ErrorMsg, pInputStatus.Error, pInputStatus.Warning, finalcallback);
                    });
                } else // Directory creation falied
                    return _PrepareAndSendCallback(PDirectoryStatus.Status, null, PDirectoryStatus.ErrorCode, PDirectoryStatus.ErrorMsg, PDirectoryStatus.Error, PDirectoryStatus.Warning, finalcallback);
            });
        });
    } catch (error) {
        return _PrepareAndSendCallback("FAILURE", '', 'ERR-RPT-60702', 'Error in SearchReport Function', error, '', finalcallback);
    }
}




function _authenticateJasper(purl, pcallback) {
    try {
        _PrintInfo('Jasper  login token url is ' + purl);
        var options = {
            url: purl,
            method: 'GET',
            "rejectUnauthorized": false,
            headers: {
                "Content-Type": "application/json"
            }
        };
        request(options, function (error, response, body) {
            if (error) {
                _PrintInfo(error);
            } else {
                pcallback(response);
            }
        });
    } catch (error) {
        return _PrepareAndSendCallback("FAILURE", '', 'ERR-RPT-60722', 'Error in _authenticateJasper Function', error, '', pcallback);
    }
}

// To get jasper server url
function _GetJasperServerUrl(pRptd_ID, AppuID, pMainReportName, pSearchparam, pDirectSrchParam, pstrSearch_info, pReqHeader, pCallback) {
    try {
        arrChildSTSId = [];
        RptInstance.GetReportConfig(pReqHeader, objLogInfo, function callbackGetReportConfig(pConfigStatus) {
            var JasperAuthurl = '';
            if (pConfigStatus.Status == 'SUCCESS') {
                try {
                    var strJasperServerInfo = JSON.parse(pConfigStatus.Data);

                    // _PrintInfo('ReportConfig - ' + JSON.stringify(strJasperServerInfo));

                    var strJSIPAddr = strJasperServerInfo['Server'] || strJasperServerInfo['SERVER'] || strJasperServerInfo['server'];
                    var strJSPort = strJasperServerInfo['Port'] || strJasperServerInfo['PORT'] || strJasperServerInfo['port'];
                    var strUsername = strJasperServerInfo['UserName'] || strJasperServerInfo['USERNAME'] || strJasperServerInfo['username'];
                    var strPwd = strJasperServerInfo['Password'] || strJasperServerInfo['PASSWORD'] || strJasperServerInfo['password'];

                    if (objLogInfo.report_path.substr(-1) == "/") {
                        objLogInfo.report_path = objLogInfo.report_path.substr(0, objLogInfo.report_path.length - 1);
                    }
                    var defaultJasperServerUrl = `{PROTOCOL}://{JASPERADDRESS}/jasperserver/flow.html?decorate=no&_flowId=viewReportFlow&_flowId=viewReportFlow&ParentFolderUri=${objLogInfo.report_path}&reportUnit=${objLogInfo.report_path}/{2}&standAlone=true&WhereCond={3}{4}{5}`;
                    JasperAuthurl = 'http://' + strJSIPAddr + ':' + strJSPort + '/jasperserver/rest/login?j_username=' + strUsername + '&j_password=' + strPwd;
                    if (pSearchparam == '')
                        pSearchparam = '1=1';
                    // _PrintInfo('ReportConfig - ' + JSON.stringify(strJasperServerInfo));

                    _PrintInfo('Report SearchParam as ' + pSearchparam);

                    _GetSessionVariable(strAppId, AppuID, pRptd_ID, JasperAuthurl, function callbackGetSessionVariable(pSessionParamStatus) {
                        if (pSessionParamStatus.Status == 'SUCCESS') {
                            var SessionParameter = pSessionParamStatus.Data.SessionParameter;
                            var tempSessionParam = "";
                            if (SessionParameter) {
                                tempSessionParam = SessionParameter.split("=").join(" = ");
                            }
                            if (pstrSearch_info && tempSessionParam) {
                                pstrSearch_info = `${pstrSearch_info} %7C ${tempSessionParam}`.replace(/&/g, ' ');
                            } else if (tempSessionParam) {
                                pstrSearch_info = ` ${tempSessionParam}`.replace(/&/g, ' ');
                            }


                            var JasperSerUrl = ServiceHelper.StringFormat(defaultJasperServerUrl, strUsername, strPwd, pMainReportName, pSearchparam, SessionParameter, pDirectSrchParam);
                            var JasperUrl = {};
                            if (pstrSearch_info) {
                                JasperSerUrl = `${JasperSerUrl}&SEARCH_INFO=${pstrSearch_info}`;
                            }
                            JasperUrl.JasperSerUrl = JasperSerUrl;
                            JasperUrl.JasperAuthurl = JasperAuthurl;
                            if (pSessionParamStatus.Data.Schema) {
                                JasperUrl.JasperSerUrl = `${JasperSerUrl}&${pSessionParamStatus.Data.Schema}`;
                            }
                            var TimezoneSetup = objLogInfo.TIMEZONE_INFO.created_date_tz;
                            var timezoneName = objLogInfo.TIMEZONE_INFO.timezone_name;
                            if (TimezoneSetup.toUpperCase() == 'TENANT_TZ') {
                                timezoneName = objLogInfo.TIMEZONE_INFO.timezone_name;
                            } else {
                                timezoneName = objLogInfo.CLIENTTZ;
                            }

                            JasperUrl.JasperSerUrl = `${JasperUrl.JasperSerUrl}&tntTimeZone=${timezoneName}`;
                            _PrintInfo('Prepared JasperServer URL - ' + JasperSerUrl);
                            return _PrepareAndSendCallback('SUCCESS', JasperUrl, '', '', null, null, pCallback);
                        } else
                            return _PrepareAndSendCallback(pSessionParamStatus.Status, null, pSessionParamStatus.ErrorCode, pSessionParamStatus.ErrorMsg, pSessionParamStatus.Error, pSessionParamStatus.Warning, pCallback);
                    });
                } catch (error) {
                    return _PrepareAndSendCallback('FAILURE', null, 'ERR-RPT-60703', 'Error on _GetJasperServerUrl()', error, null, pCallback);
                }
            } else {
                return _PrepareAndSendCallback(pConfigStatus.Status, null, pConfigStatus.ErrorCode, pConfigStatus.ErrorMsg, pConfigStatus.Error, pConfigStatus.Warning, pCallback);
            }
        });
    } catch (error) {
        return _PrepareAndSendCallback("FAILURE", '', 'ERR-RPT-60725', 'Exception in _GetJasperServerUrl()', error, '', pCallback);
    }
}

// To get session variable
function _GetSessionVariable(pAppID, pAppuID, pArptdID, pJasperAuthurl, pCallback) {
    var SessionParameter = '';

    reqFXDBInstance.GetTableFromFXDB(mDepCas, 'APP_RPT_DEFINITIONS_INFO', ['EQ_TEXT', "QUERY_PARAMS"], {
        APP_ID: pAppID,
        ARPTD_ID: pArptdID
    }, objLogInfo, function callbackGetTableFromFXDB(pError, pResult) {
        if (pError)
            return _PrepareAndSendCallback('FAILURE', SessionParameter, 'ERR-RPT-60704', 'Error on querying APP_RPT_DEFINITIONS_INFO  table to get EQ_TEXT', pError, null, pCallback);
        else if (pResult) {
            var eq_text = '';
            var QryParams = '';
            if (pResult.rows.length > 0) {
                eq_text = pResult.rows[0]['eq_text'];
                QryParams = pResult.rows[0].query_params || '';
                var lstSessionVariable = _GetSessionVariableList();

                var blnSessVarExist = false;
                var arrTmpSessVar = [];
                for (var i = 0; i < lstSessionVariable.length; i++) {
                    var hKey = lstSessionVariable[i];
                    var tmpStr = '';
                    if (eq_text.toUpperCase().indexOf("$P!{" + hKey + "}") > 0) {
                        blnSessVarExist = true;
                        arrTmpSessVar.push(hKey);
                    }
                }

                var count = 0;
                var resObj = {};
                for (var i = 0; i < arrTmpSessVar.length; i++) {
                    var hKey = arrTmpSessVar[i];
                    _GetSessionValue(hKey, pAppuID, function (pValue, status) {
                        if (status == 'FAILURE') {
                            return _PrepareAndSendCallback('FAILURE', '', '', '', null, null, pCallback);
                        } else {
                            count++;
                            tmpStr = "&" + hKey + "=" + pValue;
                            SessionParameter = SessionParameter + tmpStr;
                            resObj.SessionParameter = SessionParameter;
                            if (count == arrTmpSessVar.length) {
                                // return _PrepareAndSendCallback('SUCCESS', SessionParameter, '', '', null, null, pCallback);
                                if (QryParams.indexOf('SCHEMA') > -1) {
                                    _getSchemaDetails();
                                } else {
                                    resObj.Schema = '';
                                    _PrintInfo('Schema details not requested');
                                    return _PrepareAndSendCallback('SUCCESS', resObj, '', '', null, null, pCallback);
                                }
                            }
                        }
                    });
                }
                // if there is no session variable , return callback function
                if (!blnSessVarExist) {
                    _PrintInfo('Session variable not found for report EntityQuery...');
                    // return _PrepareAndSendCallback('SUCCESS', SessionParameter, '', '', null, null, pCallback);
                    resObj.SessionParameter = SessionParameter;
                    if (QryParams.indexOf('SCHEMA') > -1) {
                        _getSchemaDetails();
                    } else {
                        resObj.Schema = '';
                        _PrintInfo('Schema details not requested');
                        return _PrepareAndSendCallback('SUCCESS', resObj, '', '', null, null, pCallback);
                    }
                }

                async function _getSchemaDetails() {
                    _PrintInfo('Getting schema details...');
                    var serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];
                    var reqestedKeys = [];
                    var parsedqryParams = JSON.parse(QryParams);
                    //parsedqryParams = ["SCHEMA.TRANDB","SCHEMA.CLT_CAS"];
                    parsedqryParams.forEach((param) => {
                        if (param.indexOf('SCHEMA') > -1) {
                            reqestedKeys.push(param.split('SCHEMA.')[1]);
                        }
                    });
                    var reqkeys = [];
                    var arrFxKey = [];
                    var FxDbKey = '';
                    var IsTranAvail = false;
                    //To get Schema details
                    for (var j = 0; j < reqestedKeys.length; j++) {
                        if (reqestedKeys[j].indexOf('TRANDB') == -1) {
                            if (serviceModel.TRANDB == "POSTGRES") {
                                var pgKey = "POSTGRES~" + routingKey;
                                FxDbKey = pgKey;
                                if (reqkeys.indexOf(pgKey) == -1) {
                                    reqkeys.push(pgKey);
                                }
                                arrFxKey.push(reqestedKeys[j]);
                                continue;
                            } else if (serviceModel.TRANDB == "ORACLE") {
                                var oraKey = "ORACLE~" + routingKey;
                                FxDbKey = oraKey;
                                if (reqkeys.indexOf(oraKey) == -1) {
                                    reqkeys.push(oraKey);
                                }
                                arrFxKey.push(reqestedKeys[j]);
                                continue;
                            }
                        }
                        if (reqestedKeys[j].indexOf('TRANDB') > -1) {
                            TranKey = "TRANDB~" + routingKey;
                            arrFxKey.push(TranKey)
                            reqkeys.push(TranKey);
                            IsTranAvail = true;
                            continue;
                        }
                    }
                    var SchemaStr = '';
                    if (reqestedKeys.length) {
                        //Gettting FX DB Schema
                        // reqInstanceHelper.GetConfig(FxDbKey, function (CoreConfig) {
                        var pDBType = mTranDB.DBConn.DBType;
                        var curConfig = await tranDBInstance.GetSchemaDetail(pDBType, objLogInfo);
                        // var curConfig = '';
                        var CoreDbStr = '';
                        if (curConfig) {
                            for (var k = 0; k < reqestedKeys.length; k++) {
                                if (reqestedKeys[k] == 'TRANDB') {
                                    if (CoreDbStr) {
                                        if (objLogInfo.DB_MODE && objLogInfo.DB_MODE == 'ARCHIVAL') {
                                            CoreDbStr = `${CoreDbStr}&SCHEMA.TRANDB=${curConfig['arc_tran_db']} `;
                                        } else {
                                            CoreDbStr = `${CoreDbStr}&SCHEMA.TRANDB=${curConfig['tran_db']} `;
                                        }
                                    } else {
                                        // CoreDbStr = `SCHEMA.SCHEMA.TRANDB=${curConfig['tran_db']} `; 
                                        if (objLogInfo.DB_MODE && objLogInfo.DB_MODE == 'ARCHIVAL') {
                                            CoreDbStr = `SCHEMA.TRANDB=${curConfig['arc_tran_db']} `;
                                        } else {
                                            CoreDbStr = `SCHEMA.TRANDB=${curConfig['tran_db']} `;
                                        }
                                    }
                                } else {
                                    if (CoreDbStr) {
                                        CoreDbStr = `${CoreDbStr}&SCHEMA.${reqestedKeys[k]}=${curConfig[reqestedKeys[k].toLowerCase()]} `;
                                    } else {
                                        CoreDbStr = `SCHEMA.${reqestedKeys[k]}=${curConfig[reqestedKeys[k].toLowerCase()]} `;
                                    }
                                }

                            }
                            curConfig = CoreDbStr;
                            // Prepare String
                            if (SchemaStr) {
                                SchemaStr = `${SchemaStr}& ${curConfig} `;
                            } else {
                                SchemaStr = `${curConfig} `;
                            }
                            resObj.Schema = SchemaStr;
                            return _PrepareAndSendCallback('SUCCESS', resObj, '', '', null, null, pCallback);
                        } else {
                            _PrintInfo('Key not available in Redis | ' + FxDbKey);
                            return _PrepareAndSendCallback('FAILURE', resObj, 'ERR-RPT-60718', 'Key not available in Redis | ' + FxDbKey, null, null, pCallback);
                        }
                    } else {
                        resObj.Schema = SchemaStr;
                        return _PrepareAndSendCallback('SUCCESS', resObj, '', '', null, null, pCallback);
                    }


                    function GetTranSchema() {
                        if (IsTranAvail) {
                            reqInstanceHelper.GetConfig(TranKey, function (CoreConfig) {
                                //TRANDB 
                                if (CoreConfig) {
                                    var trnConfig = '';
                                    var parsedConfig = JSON.parse(CoreConfig);
                                    if (serviceModel.TRANDB == "ORACLE") {
                                        trnConfig = parsedConfig.UserID;
                                    } else {
                                        trnConfig = parsedConfig.SearchPath;
                                    }
                                    curConfig = `SCHEMA.TRANDB = ${trnConfig} `;
                                    if (SchemaStr) {
                                        SchemaStr = `${SchemaStr}& ${curConfig} `;
                                    } else {
                                        SchemaStr = `${curConfig} `;
                                    }
                                    resObj.Schema = SchemaStr;
                                    return _PrepareAndSendCallback('SUCCESS', resObj, '', '', null, null, pCallback);
                                } else {
                                    _PrintInfo('Key not available in Redis | ' + TranKey);
                                    return _PrepareAndSendCallback('FAILURE', resObj, 'ERR-RPT-60719', 'Key not available in Redis | ' + TranKey, null, null, pCallback);
                                }
                            });
                        } else {
                            resObj.Schema = SchemaStr;
                            return _PrepareAndSendCallback('SUCCESS', resObj, '', '', null, null, pCallback);
                        }
                    }

                }
            } else {
                return _PrepareAndSendCallback('FAILURE', SessionParameter, 'ERR-RPT-60705', '', null, 'APP_RPT_DEFINITIONS_INFO not found to get EQ_TEXT', pCallback);
            }
        } else
            return _PrepareAndSendCallback('FAILURE', SessionParameter, 'ERR-RPT-60706', '', null, 'APP_RPT_DEFINITIONS_INFO not found to get EQ_TEXT', pCallback);
    });
}

// To get session variable list
function _GetSessionVariableList() {
    var arrSessionVariable = [];
    arrSessionVariable.push('APPU_ID');
    arrSessionVariable.push('APPR_ID');
    arrSessionVariable.push('STS_ID');
    arrSessionVariable.push('UID');
    arrSessionVariable.push('APP_NAME');
    arrSessionVariable.push('LOGIN_NAME');
    arrSessionVariable.push('SYSTEM_ID');
    arrSessionVariable.push('SYSTEM_NAME');
    arrSessionVariable.push('CLIENT_ID');
    arrSessionVariable.push('CLUSTER_CODE');
    arrSessionVariable.push('CHILD_STS_ID');
    arrSessionVariable.push('CUR_SYS_WITH_ALL_ALLOC_CHILD');
    return arrSessionVariable;
}

// To get session value
function _GetSessionValue(pSessionKey, AppuID, pCallback) {

    _PrintInfo('Getting sessionvalue for ' + pSessionKey);
    var ResultStr = "";
    try {
        switch (pSessionKey) {
            case "APPU_ID":
                ResultStr = strAppUId;
                pCallback(ResultStr, "SUCCESS");
                break;
            case "APPR_ID":
                ResultStr = _FormStringCondition(strAppRoles);
                pCallback(ResultStr, "SUCCESS");
                break;
            case "STS_ID":
                ResultStr = strSTSId;
                pCallback(ResultStr, "SUCCESS");
                break;
            case "UID":
                ResultStr = UserID;
                pCallback(ResultStr, "SUCCESS");
                break;
            case "APP_ID":
                ResultStr = strAppId;
                pCallback(ResultStr, "SUCCESS");
                break;
            case "APP_NAME":
                ResultStr = strAppName.trim();
                pCallback(ResultStr, "SUCCESS");
                break;
            case "LOGIN_NAME":
                ResultStr = strLoginName.trim();
                pCallback(ResultStr, "SUCCESS");
                break;
            case "SYSTEM_ID":
                ResultStr = strSystemId;
                pCallback(ResultStr, "SUCCESS");
                break;
            case "SYSTEM_NAME":
                ResultStr = strSystemName.trim();
                pCallback(ResultStr, "SUCCESS");
                break;
            case "CLIENT_ID":
                ResultStr = strClientId;
                pCallback(ResultStr, "SUCCESS");
                break;
            case "CLUSTER_CODE":
                ResultStr = strClusterCode.trim();
                pCallback(ResultStr, "SUCCESS");
                break;
            case "CHILD_STS_ID":
                HandleListingMode("CUR_SYS_CHILD_SYS", AppuID, UserID, strAppSTSId, function callbackListingMode(pTokenId) {
                    var PrctTokenID = pTokenId;
                    ResultStr = _FormStringCondition(arrChildSTSId.join());
                    pCallback(ResultStr, "SUCCESS");
                });

            case "CUR_SYS_WITH_ALL_ALLOC_CHILD":
                HandleListingMode("CUR_SYS_WITH_ALL_ALLOC_CHILD", AppuID, UserID, strAppSTSId, function callbackListingMode(status, sIds) {
                    if (sIds) {
                        _PrintInfo('Got the sessionvalue for ' + pSessionKey);
                        arrChildSTSId = sIds;
                        ResultStr = _FormStringCondition(arrChildSTSId.join());
                        pCallback(ResultStr, "SUCCESS");
                    } else {
                        pCallback(status, "FAILURE");
                    }
                });
                break;
        }
    } catch (error) {
        _PrintError('ERR-RPT-60707', 'Error on _GetSessionValue() - getting ' + pSessionKey, error);
    }
}

// To initialize DB
function _InitializeDB(pHeaders, pCallback) {

    reqFXDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function CallbackGetCassandraConn(pClientDep) {
        mDepCas = pClientDep;
        reqFXDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pClientClt) {
            mCltCas = pClientClt;
            tranDBInstance.GetTranDBConn(pHeaders, false, function (pSession) {
                mTranDB = pSession;
                pCallback('Success');
            });
        });
    });
}

// To prepare search param
function __PrepareSearchParam(pParamJson, pCallback) {

    var vWhereClause = '';
    var strSearchParam = '';
    var obj = {};
    var strSearchInfo = '';
    try {
        if (pParamJson.SEARCHPARAMS != undefined && pParamJson.SEARCHPARAMS != "") {
            var objParams = JSON.parse(pParamJson.SEARCHPARAMS);
            if (objParams != "") {
                for (var i = 0; i < objParams.length; i++) {
                    var obj = objParams[i];
                    if (obj.VALUE == '' || obj.VALUE == null || obj.VALUE == "null" || obj.VALUE.toString().toUpperCase() == 'SELECT') {
                        continue;
                    }
                    if (obj.OPERATOR == "") {
                        obj.OPERATOR = "=";
                    }
                    if (obj.DATA_TYPE == "") {
                        obj.DATA_TYPE = "TEXT";
                    }
                    vWhereClause = PrepareCriteria(vWhereClause, obj.BINDING_NAME, obj.DATA_TYPE, obj.VALUE, obj.TOVALUE, obj.OPERATOR);

                    //  prepare for direct searchparam

                    var strValue = obj.VALUE;
                    var strToValue = obj.TOVALUE;
                    var value = obj.VALUE;

                    if (obj.OPERATOR.toUpperCase() == 'BETWEEN') {
                        if (obj.DATA_TYPE == 'DATE' || obj.DATA_TYPE == 'DATE TIME') {
                            strValue = reqDateFormat(strValue, 'dd-mmm-yyyy');
                            strToValue = reqDateFormat(strToValue, 'dd-mmm-yyyy');
                            value = strValue + ' TO ' + strToValue;
                        }
                    } else {
                        if (obj.DATA_TYPE == 'DATE' || obj.DATA_TYPE == 'DATE TIME') {
                            strValue = reqDateFormat(strValue, 'dd-mmm-yyyy');
                            value = strValue;
                        }
                    }
                    //To print the search param into report
                    if (strSearchInfo) {
                        strSearchInfo = `${strSearchInfo} %7C ${obj.BINDING_NAME}  ${obj.OPERATOR} ${strValue} ` + (strToValue ? ` and ${strToValue} ` : '');
                    } else {
                        strSearchInfo = `${obj.BINDING_NAME} ${obj.OPERATOR} ${strValue} ` + (strToValue ? ` and ${strToValue} ` : '');
                    }

                    var srchParamName = 'SP' + (i + 1).toString();
                    if (strSearchParam == '')
                        strSearchParam = '&' + srchParamName + '=' + value;
                    else
                        strSearchParam = strSearchParam + '&' + srchParamName + '=' + value;
                };
            }
        }
        obj = _PrepareCallbackObject('SUCCESS', null, '', '', null, null);
        return pCallback(vWhereClause, strSearchParam, strSearchInfo, obj);

    } catch (error) {
        obj = _PrepareCallbackObject('FAILURE', null, 'ERR-RPT-60708', 'Error on __PrepareSearchParam()', error, null);
        return pCallback(vWhereClause, strSearchParam, obj);
    }

}

// To prepare criteria
function PrepareCriteria(v_CONDITION, v_BINDING_NAME, v_DATA_TYPE, v_VALUE, v_TOValue, v_operator) {
    try {
        var strBindingName = v_BINDING_NAME;
        var strDataType = v_DATA_TYPE;
        var strValue = v_VALUE;
        var strToValue = v_TOValue;
        var multiselectvalues = v_VALUE;
        var strOperator = v_operator.toUpperCase();
        var strOperation = " AND ";
        if (Array.isArray(strValue)) {
            strOperator = 'LIKE';
        }
        if (v_CONDITION != "") {
            v_CONDITION = v_CONDITION + strOperation;
        }
        //TO DO
        if (strOperator == "CONTAINS") {
            strOperator = ServiceHelper.StringFormat(" LIKE UPPER  ('%25{0}%25')", strValue);
            v_CONDITION = v_CONDITION + ServiceHelper.StringFormat(" UPPER (COALESCE( {0},' ')){1}", strBindingName, strOperator);
        } else if (strOperator == "STARTS") {
            strOperator = ServiceHelper.StringFormat(" LIKE UPPER  ('{0}%25')", strValue);
            v_CONDITION = v_CONDITION + ServiceHelper.StringFormat(" UPPER (COALESCE( {0},' ')){1}", strBindingName, strOperator);
        } else if (strOperator == "ENDS") {
            strOperator = ServiceHelper.StringFormat(" LIKE UPPER  ('%25{0}')", strValue);
            v_CONDITION = v_CONDITION + ServiceHelper.StringFormat(" UPPER (COALESCE( {0},' ')){1}", strBindingName, strOperator);
        } else if (strOperator == "NOTEQUAL") {
            if (strDataType == "NUMBER") {
                strOperator = ServiceHelper.StringFormat(" <> {0}", strValue);
                v_CONDITION = v_CONDITION + ServiceHelper.StringFormat(" COALESCE(NULLIF({0},0),0){1}", strBindingName, strOperator);
            } else {
                strOperator = ServiceHelper.StringFormat(" <>UPPER  ('{0}')", strValue);
                v_CONDITION = v_CONDITION + ServiceHelper.StringFormat(" UPPER (COALESCE({0},' ')){1}", strBindingName, strOperator);
            }
        } else if (strOperator == "BETWEEN" && v_VALUE != '' && strToValue != '') {

            if (strDataType == "NUMBER") {
                // strOperator = String.Format(" <> {0}", strValue)
                v_CONDITION = v_CONDITION + ServiceHelper.StringFormat(" {0} >= {1} AND {0} <= {2} ", strBindingName, strValue, strToValue);
            } else if (strDataType == "DATE" || strDataType == "DATE TIME") {
                // strOperator = String.Format(" <>UPPER  (' {0}')", strValue)
                strValue = reqDateFormat(strValue, 'dd-mmm-yyyy');
                strToValue = reqDateFormat(strToValue, 'dd-mmm-yyyy');
                //strValue = reqDateFormatter.ConvertDate(strValue, _pHeaders);
                //strToValue = reqDateFormatter.ConvertDate(strToValue, _pHeaders);
                v_CONDITION = v_CONDITION + ServiceHelper.StringFormat(" TO_DATE(TO_CHAR( {0},'DD-MON-YYYY'),'DD-MON-YYYY')  >= TO_DATE(TO_CHAR( CAST('{1}' AS DATE),'DD-MON-YYYY'),'DD-MON-YYYY') AND TO_DATE(TO_CHAR( {0},'DD-MON-YYYY'),'DD-MON-YYYY')  <= TO_DATE(TO_CHAR( CAST('{2}' AS DATE),'DD-MON-YYYY'),'DD-MON-YYYY')", strBindingName, strValue, strToValue);
                // v_CONDITION = v_CONDITION + ServiceHelper.StringFormat(" TO_DATE(TO_CHAR( {0},'DD-MON-YYYY'),'DD-MON-YYYY')  >= TO_DATE(TO_CHAR(cast('{1}' as TIMESTAMP),'DD-MON-YYYY'),'DD-MON-YYYY') AND TO_DATE(TO_CHAR( {0},'DD-MON-YYYY'),'DD-MON-YYYY')  <= TO_DATE(TO_CHAR( cast('{2}' as TIMESTAMP),'DD-MON-YYYY'),'DD-MON-YYYY')", strBindingName, strValue, strToValue)
            }
        } else {
            if (strDataType == "VARCHAR" || strDataType == "CHAR" || strDataType == "TEXT") {
                if (strOperator == "LIKE") {
                    var strValues = '';
                    var strArray = strValue;

                    if (Array.isArray(strArray)) {
                        var c_operater = 'OR';
                        // var multivalueslikeQuery='';
                        strArray.forEach((strval) => {
                            strValues += "'" + strval + "',"; //ORIGINAL
                            // multivalueslikeQuery +="'" +"%25"+ strval + "%25"+"',";
                            // strValues += "'" +"%25"+ strval + "%25"+"',";
                        });
                        strValues = strValues.slice(0, -1);
                        multiselectvalues = multiselectvalues;


                        //MULTI SELECT COMBO REPORT CODE COMMA SEPARATED

                        var strOperatorcond = ServiceHelper.StringFormat(" IN ('{0}')", multiselectvalues); //within values only return 
                        var Condoperation = ServiceHelper.StringFormat(" IN ({0})", strValues);
                        // var Condnvalues=ServiceHelper.StringFormat(" LIKE ({0})", multivalueslikeQuery);
                        var operator = "IN";
                        v_CONDITION = v_CONDITION + ServiceHelper.StringFormat("(UPPER(COALESCE( {0},' ')) {1} {2} UPPER(COALESCE( {0},' ')) {3})", strBindingName, strOperatorcond, c_operater, Condoperation);
                        // v_CONDITION = v_CONDITION + ServiceHelper.StringFormat("(UPPER(COALESCE( {0},' ')) {1}", strBindingName, strOperatorcond)  ORIGINALLLLLL

                    } else {
                        strValues = fn_set_quotation(strValue, "");
                        v_CONDITION = v_CONDITION + ServiceHelper.StringFormat("(COALESCE( {0},' ') {1} ({2})", strBindingName, strOperator, strValues);
                    }
                } else {
                    strValue = "'" + strValue + "'";
                    v_CONDITION = v_CONDITION + ServiceHelper.StringFormat(" UPPER(COALESCE( {0},' ')){1} UPPER ({2})", strBindingName, strOperator, strValue);
                }
            } else if (strDataType == "DATE" || strDataType == "DATE TIME") {
                strValue = reqDateFormat(strValue, 'dd-mmm-yyyy');
                //strValue = reqDateFormatter.ConvertDate(strValue, _pHeaders);
                strValue = ServiceHelper.StringFormat(" TO_DATE(TO_CHAR( {0},'DD-MON-YYYY'),'DD-MON-YYYY')  = TO_DATE(TO_CHAR( cast('{1}' as DATE),'DD-MON-YYYY'),'DD-MON-YYYY')", strBindingName, strValue);
                v_CONDITION = v_CONDITION + strValue;
                // strTRNCondition.Append(String.Format("TO_DATE(TO_CHAR(TS.{0},' DD - MON - YY '),' DD - MON - YY ') {1} {2}", strBindingName, strOperator, strValue))
            } else {
                if (strValue.indexOf(',') > -1) {
                    v_CONDITION = v_CONDITION + ServiceHelper.StringFormat(" COALESCE({0},0) {1} ({2})", strBindingName, strOperator, strValue);
                } else {
                    v_CONDITION = v_CONDITION + ServiceHelper.StringFormat(" COALESCE({0},0) {1} ({2})", strBindingName, strOperator, strValue);
                }
            }
        }
    } catch (error) {
        _PrintError('ERR-RPT-60709', 'Error on PrepareCriteria()', error);
    }

    return v_CONDITION;

}

// To search report
function __SearchReport(pAppID, pAppuID, pARptd_Id, pSearchParam, pExtension, searchrptcallback) {
    try {
        var JrxmlStr = "";
        var MasterRptName = "";
        var PrctTokenID = "";
        HandleListingMode("CUR_CLUSTER_ALL_SYS", pAppuID, UserID, function (token) {
            if (token) {
                PrctTokenID = token;
                reqFXDBInstance.GetTableFromFXDB(mDepCas, 'APP_RPT_DEFINITIONS_INFO', [], {
                    APP_ID: pAppID,
                    ARPTD_ID: pARptd_Id,
                    PARENT_ARPTD_ID: '0'
                }, objLogInfo, function callbackGetTableFromFXDB(err, result) {
                    if (result.rows != undefined) {
                        JrxmlStr = result.rows[0].rpt_jrxml;
                        MasterRptName = result.rows[0].rpt_name;
                        Filehelper.CreateTempDir(DirectoryName, UserID.toString(), function callback(pFilePath) {
                            filewritepath = pFilePath;

                            if (JrxmlStr != "") {
                                __ReplaceVariable(JrxmlStr, PrctTokenID, function (pres) {
                                    if (pres) {
                                        JrxmlStr = pres;
                                        var srcFileName = path.join(filewritepath, MasterRptName + ".jrxml");
                                        var builder = new xml2js.Builder();
                                        var jrxml = builder.buildObject(JrxmlStr);
                                        fs.writeFile(srcFileName, jrxml, function (err) {
                                            if (!err) {
                                                __PrepareSubReport(pAppID, pARptd_Id, PrctTokenID, srcFileName, function (res) {
                                                    if (res) {
                                                        reqLogWriter.TraceInfo(objLogInfo, "Report Searchparam String as " + pSearchParam);
                                                        ConvertToReport(srcFileName, pSearchParam, pExtension, pAppuID, PrctTokenID, function (callback) {
                                                            var extInx = srcFileName.lastIndexOf(".");
                                                            var readpath = srcFileName.substring(0, extInx);
                                                            readpath = path.join(readpath + "." + pExtension);
                                                            GetOutputString(readpath, pExtension, function (pRes) {
                                                                return searchrptcallback(pRes);
                                                            });
                                                        });
                                                    }
                                                });
                                                // })
                                            }
                                        });
                                        // Log.Trace.TraceInfo(objLogInfo, "Report Searchparam String as " & pSearchParam);
                                    }
                                });

                            } else {
                                //Log.Trace.TraceInfo(objLogInfo, "Main report Jrxml not found")
                            }
                        });
                    }
                });
            }
        });
    } catch (ex) {
        console.log(ex.stack);
    }
}

function __PrepareSubReport(pAppId, pArptd_id, PrctTokenID, psrcFileName, preparerptcallback) {
    try {
        const subrptqry = "SELECT * FROM APP_RPT_DEFINITIONS_INFO WHERE APP_ID=? AND PARENT_ARPTD_ID=? ALLOW FILTERING;";
        var JrxmlStr = "";
        var rptName = "";
        var count = 0;
        reqFXDBInstance.GetTableFromFXDB(mDepCas, 'APP_RPT_DEFINITIONS_INFO', [], {
            APP_ID: pAppId,
            PARENT_ARPTD_ID: pArptd_id
        }, objLogInfo, function callbackGetTableFromFXDB(err, result) {
            if (result != undefined && result.rows.length != 0) {
                result.rows.forEach(function (dr) {
                    JrxmlStr = dr.rpt_jrxml;
                    rptName = dr.rpt_name;
                    if (JrxmlStr == "") {
                        // Log.Trace.TraceInfo(objLogInfo, "Subreport jrxml Not found")
                    } else {
                        __ReplacesubrptVariable(JrxmlStr, PrctTokenID, function (pres) {
                            if (pres) {
                                JrxmlStr = pres;
                                var SubRptFileName = path.join(filewritepath, rptName + ".jrxml");
                                var builder = new xml2js.Builder();
                                var jrxml = builder.buildObject(JrxmlStr);

                                fs.writeFile(SubRptFileName, jrxml, function (err) {
                                    if (!err) {
                                        if (SubReportList == "") {
                                            SubReportList = rptName + ".jrxml";

                                        } else {
                                            SubReportList = SubReportList + "~" + rptName + ".jrxml";

                                        }

                                    }
                                    count++;
                                    if (count == result.rows.length) {
                                        return preparerptcallback('Success');
                                    }
                                });
                            }
                        });
                    }
                });

            } else
                return preparerptcallback('NO SUB REPORT FOUND');
        });
    } catch (ex) {
        console.log(ex.stack);
    }
}

function ConvertToReport(pSrcFile, pCriteria, pExtension, pAppuID, PrctTokenID, convertRptcallback) {
    try {
        var TranDBServerIP = "";
        var TranDBDatabase = "";
        var UserName = "";
        var Pwd = "";
        var Port = "";
        // get tranDB detail
        var TrnDB = mTranDB.Connection;

        var config = TrnDB.client.connectionSettings;
        TranDBServerIP = config.host;
        TranDBDatabase = config.database;
        UserName = config.user;
        Pwd = config.password;
        Port = config.port;

        var ConversionType = pExtension;
        var DbType = "POSTGRES";


        if (pCriteria == "") {
            pCriteria = " 1=1 ";
        }

        RUNJAR(path.join(__dirname, "CreateReport.jar"), DbType, ConversionType, pSrcFile, SubReportList, TranDBServerIP, Port, TranDBDatabase, UserName, Pwd, " " + pCriteria, PrctTokenID, function (pStatus) {
            return convertRptcallback('SUCCESS');
        });
    } catch (ex) {
        console.log(ex.stack);
    }
}

function HandleListingMode(pListingMode, pAppuID, pUserID, pAppSTSId, Listingcallback) {
    try {
        var TokenID = reqUuid.v1();
        var count = 0;

        _PrintInfo('Listing Mode : ' + pListingMode);

        if (pListingMode == 'CUR_CLUSTER_ALL_SYS') {
            //get all appsts_id id against current appu id
            _PrintInfo('Querying app_user_sts table');
            reqFXDBInstance.GetTableFromFXDB(mCltCas, 'app_user_sts', ['appsts_id'], {
                appu_id: pAppuID
            }, objLogInfo, function (err, result) {
                if (!err) {
                    _PrintInfo('Got result from app_user_sts table');
                    lstAppsts = result.rows;
                    fetchappsts(lstAppsts, TokenID, function (stscallback) {
                        if (stscallback) {
                            Listingcallback(TokenID);
                        }
                    });
                }
            });
        } else if (pListingMode == 'CUR_SYS_CHILD_SYS') {
            _PrintInfo('Querying SYSTEM_TO_SYSTEM table');
            reqFXDBInstance.GetTableFromFXDB(mCltCas, 'SYSTEM_TO_SYSTEM', [], {
                CLUSTER_CODE: strClusterCode
            }, objLogInfo, function callbackGetTableFromFXDB(err, resSTS) {
                _PrintInfo('Got result from SYSTEM_TO_SYSTEM table');
                var arrSTS = resSTS.rows;
                _PrintInfo('Querying app_system_to_system table');
                reqFXDBInstance.GetTableFromFXDB(mCltCas, 'app_system_to_system', ['child_s_id', 'cluster_code'], {
                    appsts_id: pAppSTSId
                }, objLogInfo, function callbackGetTableFromFXDB(err, result) {
                    if (!err) {
                        _PrintInfo('Got result from app_system_to_system table');
                        arrChildSTSId.push(result.rows[0]['child_s_id']);
                        _GetSystems(result.rows, arrSTS);
                    }
                    Listingcallback('');
                });
            });
            //selected system and its all child and child's chils
        } else if (pListingMode === 'CUR_SYS_WITH_ALL_ALLOC_CHILD') {

            _getappstsfromappuser(strAppUId, objLogInfo, function (status, Result) {
                if (status == 'SUCCESS') {
                    _getappsystosys(Result, objLogInfo, function (pStatus, pResult) {
                        if (pStatus == 'SUCCESS') {
                            var sIds = [];
                            var totalRows = pResult.rows;
                            // currently selected STS
                            var arrSys = new reqLinq(totalRows)
                                .Where(function (u) {
                                    return u.s_id == strSystemId;
                                }).ToArray();

                            if (arrSys.length) {
                                preparesid(arrSys[0]);
                            }

                            function preparesid(psysdata) {
                                sIds.push(psysdata.s_id);
                                preparechildata(psysdata);
                            }

                            function preparechildata(sysdata) {
                                try {
                                    for (var sysd in totalRows) {
                                        if (sysdata.child_s_id == totalRows[sysd].parent_s_id) {
                                            preparesid(totalRows[sysd]);
                                        }
                                    }
                                } catch (error) {
                                    console.log(error);
                                }
                            }
                            console.log('sIds---------------' + JSON.stringify(sIds));
                            _PrintInfo('System ids are ' + JSON.stringify(sIds));
                            return Listingcallback('', sIds);
                        } else {
                            Listingcallback(pResult);
                        }
                    });
                } else {
                    Listingcallback(Result);
                }
            });
        }
    } catch (error) {
        _PrintError('ERR-RPT-60710', 'Error on HandleListingMode()', error);
    }
}

function _getappsystosys(pAppSTSId, objLogInfo, pCallback) {
    try {
        _PrintInfo('Querying app_system_to_system table - _getappsystosys');
        // var strQuery = "SELECT CHILD_S_ID,S_ID,S_DESCRIPTION,PARENT_S_ID,APPSTS_ID FROM APP_SYSTEM_TO_SYSTEM WHERE APP_ID='" + strAppId + "' AND CLUSTER_CODE='" + strClusterCode + "' AND APPSTS_ID IN (" + pAppSTSId + ")";
        var strQuery = {
            query: "SELECT CHILD_S_ID,S_ID,S_DESCRIPTION,PARENT_S_ID,APPSTS_ID FROM APP_SYSTEM_TO_SYSTEM WHERE APP_ID= ? AND CLUSTER_CODE= ? AND APPSTS_ID IN (?)",
            params: [strAppId, strClusterCode, pAppSTSId]
        }
        reqFXDBInstance.ExecuteQuery(mCltCas, strQuery, objLogInfo, function callback(err, result) {
            if (!err) {
                _PrintInfo('Got result from app_system_to_system table');
                pCallback('SUCCESS', result);
            } else {
                _PrintInfo('Error Occured to get the APP_SYSTEM_TO_SYSTEM .  The error is  ' + err);
                pCallback('FAILURE', err);
            }
        });
    } catch (error) {
        _PrintError('ERR-RPT-60711', 'Error on _getappsystosys()', error);
    }
}


function _getappstsfromappuser(pAppuID, objLogInfo, pCallback) {
    try {
        _PrintInfo('Querying APP_USER_STS table to get pEligibleAppsts');
        reqFXDBInstance.GetTableFromFXDB(mCltCas, 'APP_USER_STS', ['APPSTS_ID'], {
            appu_id: pAppuID
        }, objLogInfo, function callback(pError, pEligibleAppsts) {
            if (!pError) {
                _PrintInfo('Got result from app_system_to_system table');
                var arrAppSts = new reqLinq(pEligibleAppsts.rows).Select(function (item) {
                    return "'" + item['appsts_id'] + "'";
                });
                var strsAppSts = arrAppSts.items.join();
                _PrintInfo('Querying APP_USER_STS table to get pEligibleAppsts Done');
                pCallback('SUCCESS', strsAppSts);
            } else {
                _PrintInfo('Error Occured querying APP_USER_STS table ' + pError);
                pCallback('FAILURE', pError);
            }
        });
    } catch (error) {

    }
}

function _GetSystems(pAPPSTSRows, pSTSRows) {
    try {
        reqAsync.forEach(pAPPSTSRows, function (appsts, callbackSer) {
            _GetChildSystems(appsts['child_s_id'], pSTSRows);
            callbackSer();
        }, function (err) { });
    } catch (error) {
        _PrintError('ERR-RPT-60711', 'Error on _GetSystems()', error);
    }
}

function _GetChildSystems(pParent_S_ID, pSTSRows) {
    try {
        arrChildSTSId.push(pParent_S_ID);

        var obj = new reqLinq(pSTSRows).Where(function (row) {
            return row['parent_s_id'] === pParent_S_ID;
        }).ToArray();

        reqAsync.forEach(obj, function (sysToSys, callbackSer) {
            _GetChildSystems(sysToSys['child_s_id'], pSTSRows);
            callbackSer();
        }, function (err, result) {

        });

    } catch (error) {
        _PrintError('ERR-RPT-60712', 'Error on _GetChildSystems()', error);
    }
}

function TranRptinsert(Pappstsrow, trancallback) {
    reqInstanceHelper.PrintInfo(strServiceName, 'Inserting in TranDB TMP_RPT_CHILDSTS  table', objLogInfo);
    tranDBInstance.InsertTranDB(mTranDB, 'TMP_RPT_CHILDSTS', Pappstsrow, objLogInfo, function attcallback(Res) {
        if (Res) {
            reqInstanceHelper.PrintInfo(strServiceName, 'Insert have been Done Success', objLogInfo);
            //console.log('Insert Success')
            return trancallback('Success');
        }

    });
}

function RUNJAR(pCommand, DbType, ConversionType, srcFileName, subRptList, DBServerIp, Port, DBName, UserName, Pwd, pSearchParam, pPRCTID, pCallback) { //, jarpcallback) {
    var child = require('child_process').spawn(
        'java', ['-jar', pCommand, DbType, ConversionType, '' + srcFileName + '', subRptList, DBServerIp, Port, DBName, UserName, Pwd, '' + pSearchParam + '', pPRCTID]);
    child.stdout.on('data', function (data) {
        console.log("SUCCESS" + data.toString());
        //return jarpcallback("SUCCESS")
    });

    child.stderr.on("data", function (data) {
        console.log("ERROR" + data.toString());
        // return jarpcallback("SUCCESS")
    });
    child.on('close', function (code) {
        console.log('process exit code ' + code);
        pCallback('success');
    });
    //return jarpcallback("SUCCESS")

}

function fetchappsts(plstAppsts, pTokenid, appstscallback) {
    var count = 0;
    try {
        for (var i = 0; i < plstAppsts.length; i++) {
            var appstsId = plstAppsts[i];
            reqInstanceHelper.PrintInfo(strServiceName, 'Querying app_system_to_system table', objLogInfo);
            reqFXDBInstance.GetTableFromFXDB(mCltCas, 'app_system_to_system', ['child_s_id', 'cluster_code'], {
                appsts_id: appstsId['appsts_id']
            }, objLogInfo, function callbackGetTableFromFXDB(pError, pResult) {
                if (pError)
                    _PrintError('ERR-RPT-60713', 'Querying app_system_to_system table have been Failed', pError);
                else {
                    count++;
                    for (var j = 0; j < pResult.rows.length; j++) {
                        appstsrow.push({
                            TOKEN_ID: pTokenid,
                            CHILD_S_ID: pResult.rows[j]['child_s_id']
                        });
                        arrChildSTSId.push(pResult.rows[j]['child_s_id']);
                    }
                    if (count == plstAppsts.length) {
                        // TranRptinsert(appstsrow, function(resultcallback) {
                        appstscallback('SUCCESS');
                    }
                }
            });
        }
    } catch (error) {
        _PrintError('ERR-RPT-60714', 'Error on fetchappsts() function', error);
    }
}

function __ReplacesubrptVariable(pJrxml, pPrctTokenID, subrescallback) {
    try {
        var JrxmlStr = '';
        var SelectQryStr = '';
        GetQueryStringFromJrxml(pJrxml, function (value) {
            if (value) {
                SelectQryStr = value;
                if (SelectQryStr != "") {
                    //APPLYING LISTING MODE
                    SelectQryStr = SelectQryStr.replace("$CHILD_STS_ID", " SELECT CHILD_S_ID FROM TMP_RPT_CHILDSTS WHERE TOKEN_ID='" + pPrctTokenID + "'");

                    //APPLYING SESSION FILTER
                    SelectQryStr = SelectQryStr.replace("$APPU_ID", strAppUId);
                    SelectQryStr = SelectQryStr.replace("$APPR_ID", _FormStringCondition(strAppRoles));
                    SelectQryStr = SelectQryStr.replace("$STS_ID", strSTSId);
                    SelectQryStr = SelectQryStr.replace("$UID", UserID);
                    SelectQryStr = SelectQryStr.replace("$APP_ID", strAppId);
                    SelectQryStr = SelectQryStr.replace("$APP_NAME", "'" + strAppName.trim + "'");
                    SelectQryStr = SelectQryStr.replace("$LOGIN_NAME", "'" + strLoginName.trim + "'");

                    SelectQryStr = SelectQryStr.replace("$SYSTEM_ID", "'" + strSystemId + "'");
                    SelectQryStr = SelectQryStr.replace("$SYSTEM_NAME", "'" + strSystemName.trim + "'");
                    SelectQryStr = SelectQryStr.replace("$CLIENT_ID", "'" + strClientId + "'");
                    SelectQryStr = SelectQryStr.replace("$CLUSTER_CODE", "'" + strClusterCode.trim + "'");
                    //  Log.Trace.TraceInfo(objLogInfo, "Report Query as " + SelectQryStr)
                    SetQueryStringToJrxml(pJrxml, SelectQryStr, function (res) {
                        if (res) {
                            return subrescallback(res);
                        }
                    });
                }
            }

        });

    } catch (ex) {
        console.log(ex.stack);
    }

}

function __ReplaceVariable(pJrxml, pPrctTokenID, mainrptrescallback) {
    var JrxmlStr = '';
    var SelectQryStr = '';
    GetQueryStringFromJrxml(pJrxml, function (value) {
        if (value) {
            SelectQryStr = value;
            if (SelectQryStr != "") {
                //APPLYING LISTING MODE
                SelectQryStr = SelectQryStr.replace("$CHILD_STS_ID", " SELECT CHILD_S_ID FROM TMP_RPT_CHILDSTS WHERE TOKEN_ID='" + pPrctTokenID + "'");

                //APPLYING SESSION FILTER
                SelectQryStr = SelectQryStr.replace("$APPU_ID", strAppUId);
                SelectQryStr = SelectQryStr.replace("$APPR_ID", _FormStringCondition(strAppRoles));
                SelectQryStr = SelectQryStr.replace("$STS_ID", strSTSId);
                SelectQryStr = SelectQryStr.replace("$UID", UserID);
                SelectQryStr = SelectQryStr.replace("$APP_ID", strAppId);
                SelectQryStr = SelectQryStr.replace("$APP_NAME", "'" + strAppName.Trim + "'");
                SelectQryStr = SelectQryStr.replace("$LOGIN_NAME", "'" + strLoginName.Trim + "'");

                SelectQryStr = SelectQryStr.replace("$SYSTEM_ID", "'" + strSystemId + "'");
                SelectQryStr = SelectQryStr.replace("$SYSTEM_NAME", "'" + strSystemName.Trim + "'");
                SelectQryStr = SelectQryStr.replace("$CLIENT_ID", "'" + strClientId + "'");
                SelectQryStr = SelectQryStr.replace("$CLUSTER_CODE", "'" + strClusterCode.Trim + "'");
                SelectQryStr = SelectQryStr.replace("$CUR_SYS_WITH_ALL_ALLOC_CHILD", "'" + strClusterCode.Trim + "'");

                //  Log.Trace.TraceInfo(objLogInfo, "Report Query as " + SelectQryStr)
                SetQueryStringToJrxml(pJrxml, SelectQryStr, function (res) {
                    if (res) {
                        return mainrptrescallback(res);
                    }
                });
            }
        }
    });
}

function GetQueryStringFromJrxml(pJrxml, xmlrescalback) {
    parser.parseString(pJrxml, function (err, result) {
        var value = result.jasperReport.queryString;
        return xmlrescalback(value[0]);
    });
}

function GetOutputString(Ppath, pext, outputcalback) {
    if (pext == 'html') {
        fs.readFile(Ppath, 'utf8', function (err, data) {
            if (!err) {
                var result = data;
                result = data;
                Filehelper.DisposeTempFile(Ppath);
                outputcalback(result);
            } else
                outputcalback(err);

        });
    } else {
        fs.readFile(Ppath, function (err, data) {
            if (!err) {
                result = new Buffer.from(data).toString('base64');
                Filehelper.DisposeTempFile(Ppath);
                outputcalback(result);
            } else
                outputcalback(err);
        });

    }
}

function SetQueryStringToJrxml(pJrxml, query, res) {
    parser.parseString(pJrxml, function (err, result) {
        result.jasperReport.queryString[0] = query;
        return res(result);
    });
}

function _FormStringCondition(pString) {
    if (pString == '')
        return '';
    var strValues = pString.split(',');
    var strTemp = '';
    for (var i = 0; i < strValues.length; i++) {
        if (strTemp == '')
            strTemp = strTemp + "'" + strValues[i] + "'";
        else
            strTemp = strTemp + ",'" + strValues[i] + "'";
    }
    return strTemp;
}

function __InitializeParams(pClientParams, pSessionInfo, pCallback) {
    var SessionId = '';
    try {
        if (pClientParams.RPT_NAME) {
            strRptName = pClientParams.RPT_NAME;
        }
        if (pClientParams.ARPTD_ID) {
            ARPTD_ID = pClientParams.ARPTD_ID;
        }
        // Session level params

        if (pSessionInfo.APPU_ID) {
            strAppUId = pSessionInfo.APPU_ID;
        }
        if (pSessionInfo.APP_USER_ROLES) {
            strAppRoles = pSessionInfo.APP_USER_ROLES;
        }

        if (pSessionInfo.STS_ID) {
            strSTSId = pSessionInfo.STS_ID;
        }

        if (pSessionInfo.U_ID) {
            UserID = pSessionInfo.U_ID;
        }
        if (pSessionInfo.APP_ID) {
            strAppId = pSessionInfo.APP_ID;
        }

        if (pSessionInfo.APP_NAME) {
            strAppName = pSessionInfo.APP_NAME;
        }

        if (pSessionInfo.LOGIN_NAME) {
            strLoginName = pSessionInfo.LOGIN_NAME;
        }

        if (pSessionInfo.S_DESC) {
            strSystemName = pSessionInfo.S_DESC;
        }

        if (pSessionInfo.S_ID) {
            strSystemId = pSessionInfo.S_ID;
        }

        if (pSessionInfo.CLIENT_ID) {
            strClientId = pSessionInfo.CLIENT_ID;
        }
        if (pSessionInfo.CLUSTER_CODE) {
            strClusterCode = pSessionInfo.CLUSTER_CODE;
        }

        if (pSessionInfo.APP_STS_ID)
            strAppSTSId = pSessionInfo.APP_STS_ID;

        return _PrepareAndSendCallback('SUCCESS', null, '', '', null, null, pCallback);

    } catch (error) {
        return _PrepareAndSendCallback('FAILURE', null, 'ERR-RPT-60715', 'Error in _InitializeParams function ', error, null, pCallback);
    }
}

function _GetRedisKey(pKey, pCallback) {
    const constSession = 'SESSIONID-';
    pKey = constSession + pKey;
    reqInstanceHelper.GetConfig(pKey, function callbackGetRedisKey(pRes, pErr) {
        pCallback(pRes, pErr);
    });
}


// To print the Error
function _PrintError(pErrCode, pMessage, pError) {
    reqInstanceHelper.PrintError('SearchReport', objLogInfo, pErrCode, pMessage, pError);
}

// To print the information 
function _PrintInfo(pMessage) {
    reqInstanceHelper.PrintInfo('SearchReport', pMessage, objLogInfo);
}

// To prepare and send callback object
function _PrepareAndSendCallback(pStatus, pData, pErrorCode, pErrMsg, pError, pWarning, pCallback) {
    var objCallback = {
        Status: pStatus,
        Data: pData,
        ErrorCode: pErrorCode,
        ErrorMsg: pErrMsg,
        Error: pError,
        Warning: pWarning
    };
    return pCallback(objCallback);
}

// To prepare the callback object
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

module.exports = {
    SearchReport: SearchReport
};
/*********** End of Service **********/