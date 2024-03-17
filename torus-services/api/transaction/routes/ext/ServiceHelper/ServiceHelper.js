/****
 * Created by Shanthi on 7/1/2016.
 * Description : parse the dt relation_json - common function
 ****/

// Require dependencies
var reqFXInstance = require('../../../../../../torus-references/instance/DBInstance');
var reqInsHelper = require('../../../../../../torus-references/common/InstanceHelper')
var reqSendMsg = require('../../../../../../torus-references/communication/core/SendMessage')

function GetRelationJSON(pDTINFO) {
    var REL_JSON = {};
    var arrRelJson = [];
    try {
        if (pDTINFO.rows.length > 0)
            for (var i = 0; i < pDTINFO.rows.length; i++) {
                var relJson = pDTINFO.rows[0].relation_json;
                var jarrRel = JSON.parse(relJson);
                for (var i = 0; i < jarrRel.length; i++)
                    arrRelJson[i] = jarrRel[i]
                REL_JSON = arrRelJson;
            }
    } catch (ex) {}
    return REL_JSON
}

function GetKeyColumn(pCasIns, pAppId, pDTCode, pDTTCode, pLogInfo, pCallback) {
    var objCallbak = {}
    try {
        const DTINFO = 'SELECT RELATION_JSON FROM DT_INFO WHERE APP_ID=? AND DT_CODE=? ;'
        reqFXInstance.GetTableFromFXDB(pCasIns, 'DT_INFO', ['RELATION_JSON'], {
            'APP_ID': pAppId,
            'DT_CODE': pDTCode
        }, pLogInfo, function callback(pError, pResult) {
            if (pError) {
                var objCallbak = _PrepareCallbackObject('FAILURE', '', 'ERR-HAN-40161', 'Error on GetKeyColumn()', pError, null)
                return pCallback(objCallbak)
            } else {
                if (pResult.rows.length > 0) {
                    var strRelationJson = pResult.rows[0]['relation_json']
                    var tmpstr = GetTargetTableAndKeyColumn(JSON.parse(strRelationJson), pDTTCode, pLogInfo)
                    return pCallback(tmpstr)
                }
            }
        })
    } catch (error) {
        objCallbak = _PrepareCallbackObject('FAILURE', '', 'ERR-HAN-40162', 'Error on GetKeyColumn()', error, null)
        return pCallback(objCallbak)
    }
}

function GetTargetTableAndKeyColumn(pRelationJson, pDTTCode, pLogInfo) {
    var tmpStr = ''
    for (var j = 0; j < pRelationJson.length; j++) {
        tmpStr = _GetHierarchyDTT(pRelationJson[j], pDTTCode, pLogInfo)
        if (tmpStr != undefined && tmpStr.Status == 'SUCCESS') {
            if (tmpStr.Data != undefined && tmpStr.Data != null && tmpStr.Data != '')
                break;
        }
        if (tmpStr != undefined && tmpStr.Status == 'FAILURE') // if error in _GetHierarchyDTT()
            break;

    }
    return tmpStr
}

function _GetHierarchyDTT(pRelationJson, pDTTCode, pLogInfo) {
    var obj = {}
    try {
        var objRelationJson = pRelationJson
        var strTargetTable = ''
        var strKeyColumn = ''
        var strDTTDescription = ''
        var strDTTCategory = ''
            // Find targettable and keycolumn for selected DTTCode
        if (objRelationJson.DTT_CODE == pDTTCode) {
            strTargetTable = objRelationJson['TARGET_TABLE']
            strKeyColumn = objRelationJson['PRIMARY_COLUMN']
            strDTTDescription = objRelationJson['DTT_DESCRIPTION']
            strDTTCategory = objRelationJson['CATEGORY']
            var strDTTInfo = strTargetTable + ',' + strKeyColumn + ',' + strDTTDescription + ',' + strDTTCategory
                //return strTargetTable + ',' + strKeyColumn + ',' + strDTTDescription + ',' + strDTTCategory
            obj = _PrepareCallbackObject('SUCCESS', strDTTInfo, '', '', null, null)
            return obj
        }

        // find on child dtt relation
        for (var i = 0; i < objRelationJson.CHILD_DTT_RELEATIONS.length; i++) {
            var rtn = _GetHierarchyDTT(objRelationJson.CHILD_DTT_RELEATIONS[i], pDTTCode, pLogInfo)
            if (rtn != null)
                return rtn
        }
    } catch (error) {
        obj = _PrepareCallbackObject('FAILURE', '', 'ERR-HAN-40163', 'Error on _GetHierarchyDTT()', error, null)
        return obj
    }
}

function SendMail(pDepCas, pOTPSMSTemplate, pOTPMailTemplate, pData, pType, pLogInfo, pHeader, pInputParam, pCallback) {
    var strOTPSMSTemplate = ''
    var strOTPMAILTemplate = ''
    try {

        if (pOTPSMSTemplate != '')
            strOTPSMSTemplate = pOTPSMSTemplate

        if (pOTPMailTemplate != '')
            strOTPMAILTemplate = pOTPMailTemplate

        var strEmailID = (pInputParam.SessionInfo.USER_EMAIL != undefined && pInputParam.SessionInfo.USER_EMAIL != null) ? pInputParam.SessionInfo.USER_EMAIL : '';
        var strMobileNo = (pInputParam.SessionInfo.USER_MOBILE != undefined && pInputParam.SessionInfo.USER_MOBILE != null) ? pInputParam.SessionInfo.USER_MOBILE : '';

        _PrepareMsgData(pDepCas, strOTPSMSTemplate, strOTPMAILTemplate, pType, pLogInfo, function callbackPrepareMsgData(pTemplates) {
            var objMsgTemplts = pTemplates
            if (objMsgTemplts.length > 0) {
                for (var j = 0; j < objMsgTemplts.length; j++) {
                    var objMsgTemp = objMsgTemplts[j]
                    if (objMsgTemp.CATEGORY_INFO.COMMC_CONFIG.CONFIG.TYPE.toUpperCase() == "MAIL") {
                        reqSendMsg.SendMessage(pHeader, pInputParam, objMsgTemp, pData, strEmailID, strMobileNo, pLogInfo, function callback() {
                            pCallback('SUCCESS')
                        })
                    }
                }
            } else
                pCallback('SUCCESS')
        })

    } catch (ex) {
        _PrintError(pLogInfo, 'Error while Sending OTP ', 'ERR-FX-10508', ex)
    }
}

function ParseSelectedTran(pLstTran, pSelectedTran, pUsername, pEmailId) {
    for (var i = 0; i < pSelectedTran.length; i++) {
        var dr = pSelectedTran[i]
        var objTran = {}
        Object.keys(dr).forEach(function(col) {
            objTran[col.toString().toLowerCase()] = dr[col]
        })
        objTran['user_name'] = pUsername
        objTran['email_id'] = pEmailId
        pLstTran.push(objTran)
    }

}

function _PrepareMsgData(pDepCas, pOTPSMSTemp, pOTPMailTemp, pType, pLogInfo, pCallback) {
    var objMsgTemplts = []
    var authenticationmodel = 'MAIL'
    try {
        if (authenticationmodel == 'MAIL')
            pOTPSMSTemp = ""
        else if (authenticationmodel == 'SMS')
            pOTPMailTemp = ""

        _GetCommMsgTemplate(pDepCas, pOTPSMSTemp, pOTPMailTemp, pLogInfo, function callbackGetCommMsgTemplate(pTemplates) {
            var lstComm = pTemplates

            if (lstComm == undefined || lstComm === null || lstComm.length == 0) {
                _PrintError(pLogInfo, 'Communication info setup is Missing', 'ERR-FX-10514', null)
            } else {
                for (var i = 0; i < lstComm.length; i++) {
                    var rw = lstComm[i]
                    var objMsgTemplt = {}
                    objMsgTemplt.CATEGORY_INFO = JSON.parse(rw['category_info'])
                    objMsgTemplt.TEMPLATE_INFO = JSON.parse(rw['template_info'])
                    objMsgTemplt.ATTACHMENTs = []
                    if (pType == 'DELETE_CONTENT')
                        objMsgTemplt.CONTACT_INFOs = JSON.parse(rw['contact_info'])
                    else {
                        var TOC = [{
                            ADDRESS_TYPE: 'TO',
                            COLUMN_NAME: 'email_id',
                            STATIC_ADDRESS: ''
                        }]
                        objMsgTemplt.CONTACT_INFOs = TOC
                    }
                    objMsgTemplts.push(objMsgTemplt)
                }
            }
            pCallback(objMsgTemplts)
        })
    } catch (ex) {
        _PrintError(pLogInfo, "Error while preparing communication message templates - __PrepareMsgData() ", 'ERR-FX-10513', ex)
    }
    return objMsgTemplts
}

function _GetCommMsgTemplate(pDepCas, pOTPSMSTemp, pOTPMailTemp, pLogInfo, pCallback) {
    var lstComm = []
    var COMMINFO = "SELECT * FROM COMM_INFO WHERE APP_ID = '0' AND WFTPA_ID= 'DEFAULT' AND  EVENT_CODE='DEFAULT' AND DT_CODE= 'DEFAULT' AND  DTT_CODE = 'DEFAULT' AND  COMMMT_CODE = ? ALLOW FILTERING ;"
    if (pOTPSMSTemp != '' && pOTPMailTemp == "")
        reqFXInstance.GetTableFromFXDB(pDepCas, 'COMM_INFO', [], {
            'APP_ID': '0',
            'WFTPA_ID': 'DEFAULT',
            'EVENT_CODE': 'DEFAULT',
            'DT_CODE': 'DEFAULT',
            'DTT_CODE': 'DEFAULT',
            'COMMMT_CODE': pOTPSMSTemp
        }, pLogInfo, function callbackGetCommInfo(pError, pResult) {
            if (pError)
                _PrintError(pLogInfo, 'Error on querying COMM_INFO table', 'ERR-DB-50001', pError)
            else if (pResult) {
                lstComm = pResult.rows
            }
            pCallback(lstComm)
        })
    else if (pOTPMailTemp != '' && pOTPSMSTemp == '')
        reqFXInstance.GetTableFromFXDB(pDepCas, 'COMM_INFO', [], {
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
                _PrintError(pLogInfo, 'Error on execute query on COMM_INFO ', 'ERR-DB-50001', pError)
            else if (pResult) {
                lstComm = pResult.rows
            }
            pCallback(lstComm)
        })
}


function _PrintError(pLogInfo, pMessage, pErrorCode, pError) {
    reqInsHelper.PrintError('ServiceHelper', pLogInfo, pErrorCode, pMessage, pError)
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
    }
    return objCallback
}

module.exports = {
    GetRelationJSON: GetRelationJSON,
    GetTargetTableAndKeyColumn: GetTargetTableAndKeyColumn,
    GetKeyColumn: GetKeyColumn,
    SendMail: SendMail,
    ParseSelectedTran: ParseSelectedTran
}