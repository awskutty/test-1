// Require dependencies
var reqExpress = require('express');
var reqCasInstance = require('../../../../../torus-references/instance/CassandraInstance');
var reqTranDBHelper = require('../../../../../torus-references/instance/TranDBInstance');
var reqUuid = require('uuid');
var reqDBInstance = require('../../../../../torus-references/instance/DBInstance');

// Cassandra initialization
var mClient;
var mTranDB;
var strOrm = 'knex';
var strfoldertrn_id = '';
var objLogInfo = '';

try {

    function SaveList(req, reqdata, dynamicresult, pCallback) {
        reqTranDBHelper.GetTranDBConn(reqdata.headers, false, function(pSession) {
            mTranDB = pSession;


            //    reqCasInstance.GetCassandraConn(reqdata.headers, 'dep_cas', function Callback_GetCassandraConn(pClient) {
            reqDBInstance.GetFXDBConnection(reqdata.headers, 'dep_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
                mClient = pClient;

                // Initialize local variables
                var strAppStsId = req.APPSTS_ID;
                var strAppId = req.APP_ID;
                var strAtmtDtCode = req.ATMT_DT_CODE;
                var strDttCode = req.DTT_CODE;
                var strDtCode = req.DT_CODE;
                var strLogInfo = req.LOGINFO;
                var strspuid = req.SPU_ID;
                var strLoginName = req.LOGIN_NAME;
                var strRSParams = req.RSPARAMS;
                var strSysDesc = req.SYSTEM_DESC;
                var strSysId = req.SYSTEM_ID;
                var strTrnId = req.TRN_ID;
                var strRelJson = ''
                var strSource = req.SOURCE ? req.SOURCE : 'MANUAL';
                var strSourceDet = req.SOURCE_DETAILS ? req.SOURCE_DETAILS : 'FROM FOLDER';
                var strParentKeyColumn = req.PARENTKEYCOLUMN;
                var strParentKeyValue = req.PARENTKEYVALUE;
                var arrAtmtDTTRel = [];
                var arrRSPItem = [];
                var strGroupId = '';
                var strAtmtTsId = '0';
                var strAtmtTRNId = '0';
                var strChkTrnId = '';
                var strATDesc = '';
                var strAttachTitle = '';
                var strDttaId = '0';
                var strDttadId = '0';
                var strInputParam = req;
                var objLogInfo;
                var strFolderdttcode = '';
                var strDtDesc = ''
                var arrDTTRel = [];

                // Prepare query
                const SELDTTINFO = 'select app_id,dtt_code,dtt_description,dtt_dfd_json from dtt_info where dtt_code=? and app_id=? allow filtering';
                const SELDTINFO = 'Select app_id,dt_code,dt_description,relation_json from dt_info where dt_code=? and app_id =? allow filtering';
                const SELAT = 'select at_code,at_description from attachment_types where at_code=?';

                if (strSource == 'SCAN') {
                    strFolderdttcode = req.FOLDER_DTT_CODE;
                    strfoldertrn_id = req.FOLDER_TRN_ID;
                }


                if (req.DT_CODE) {
                    SelectDTInfo(strDtCode)
                }

                //Get relationjson
                function SelectDTInfo(pDtCode) {
                    try {
                        if (pDtCode == strAtmtDtCode) {
                            // mClient.execute(SELDTINFO, [pDtCode, strAppId], {
                            //     prepare: true
                            // }, function callbackSelA(pError, pResult) {

                            var conddt = new Object();
                            conddt.dt_code = pDtCode;
                            conddt.app_id = strAppId;
                            reqDBInstance.GetTableFromFXDB(mClient, 'DT_INFO', ['app_id', 'dt_code', 'dt_description', 'relation_json'], conddt, objLogInfo, function(pError, pResult) {

                                if (pError) {
                                    console.error(pError);
                                } else if (pResult) {
                                    try {
                                        if (pResult.rows.length > 0)
                                            strRelJson = JSON.parse(pResult.rows[0].relation_json);

                                        _GetRSParams();
                                    } catch (error) {
                                        printError(error)
                                    }
                                }
                            })
                        } else if (pDtCode != '' && strAtmtDtCode != '') {
                            if (pDtCode != strAtmtDtCode) {
                                strDtCode = strAtmtDtCode
                                SelectDTInfo(strAtmtDtCode);
                            }

                        } else if (pDtCode != '' && strAtmtDtCode == '') {
                            strAtmtDtCode = pDtCode;
                            SelectDTInfo(pDtCode);
                        }
                    } catch (error) {
                        printError(error)
                    }
                }

                function _PrepareDttRelation(strRelJson, strdtcode) {
                    try {

                        if (strRelJson[0].CHILD_DTT_RELEATIONS.length > 0) {
                            strChildDTTRel = strRelJson[0].CHILD_DTT_RELEATIONS;
                            for (var i = 0; i < strChildDTTRel.length; i++) {
                                if (strChildDTTRel[i].CATEGORY == 'T') {
                                    objChildDTTRel = {};
                                    objChildDTTRel.DTT_CATEGORY = strChildDTTRel[i].CATEGORY;
                                    objChildDTTRel.DTT_DESCRIPTION = strChildDTTRel[i].DTT_DESCRIPTION;
                                    objChildDTTRel.DTT_CODE = strChildDTTRel[i].DTT_CODE;
                                    objChildDTTRel.TARGET_TABLE = strChildDTTRel[i].TARGET_TABLE;
                                    objChildDTTRel.PRIMARY_COLUMN = strChildDTTRel[i].PRIMARY_COLUMN;
                                    arrDTTRel.push(objChildDTTRel);
                                    if (strChildDTTRel[i].CHILD_DTT_RELEATIONS.length > 0) {
                                        strChildDTTRel = strChildDTTRel[i].CHILD_DTT_RELEATIONS;
                                        _PrepareDttRelation();
                                    }
                                } else if (strChildDTTRel[i].CATEGORY == 'S') {
                                    if (strChildDTTRel[i].CHILD_DTT_RELEATIONS.length > 0) {
                                        strChildDTTRel = strChildDTTRel[i].CHILD_DTT_RELEATIONS;
                                        _PrepareDttRelation();
                                    }
                                }
                            }
                        }
                        _PrepareATMTDttRelation(strRelJson, strdtcode)

                    } catch (error) {
                        printError(error)
                    }
                }

                function _PrepareATMTDttRelation(strRelJson, strdtcode) {
                    try {


                        if (strRelJson[0].CHILD_DTT_RELEATIONS.length > 0) {
                            strChildDTTRel = strRelJson[0].CHILD_DTT_RELEATIONS;
                            for (var i = 0; i < strChildDTTRel.length; i++) {
                                if (strChildDTTRel[i].CATEGORY == 'S') {
                                    objChildAtmtDTTRel = {};
                                    objChildAtmtDTTRel.DTT_CATEGORY = strChildDTTRel[i].CATEGORY;
                                    objChildAtmtDTTRel.DTT_DESCRIPTION = strChildDTTRel[i].DTT_DESCRIPTION;
                                    objChildAtmtDTTRel.DTT_CODE = strChildDTTRel[i].DTT_CODE;
                                    objChildAtmtDTTRel.TARGET_TABLE = strChildDTTRel[i].TARGET_TABLE;
                                    objChildAtmtDTTRel.PRIMARY_COLUMN = strChildDTTRel[i].PRIMARY_COLUMN;
                                    arrAtmtDTTRel.push(objChildAtmtDTTRel);
                                    if (strChildDTTRel[i].CHILD_DTT_RELEATIONS.length > 0) {
                                        strChildDTTRel = strChildDTTRel[i].CHILD_DTT_RELEATIONS;
                                        _PrepareATMTDttRelation();
                                    }
                                } else if (strChildDTTRel[i].CATEGORY == 'T') {
                                    if (strChildDTTRel[i].CHILD_DTT_RELEATIONS.length > 0) {
                                        strChildDTTRel = strChildDTTRel[i].CHILD_DTT_RELEATIONS;
                                        _PrepareATMTDttRelation();
                                    }
                                }
                            }
                        }
                        _GetRSParams();
                    } catch (error) {
                        printError(error)
                    }
                }
                var arrGetRSP = [];

                function _GetRSParams() {
                    try {

                        if (strRSParams != '') {
                            if (typeof strRSParams == 'string' && strSource == 'MANUAL') {
                                var strPrsRsParams = JSON.parse(strRSParams);
                                strLogInfo = JSON.parse(strLogInfo);
                                for (i = 0; i < strPrsRsParams.Items.length; i++) {
                                    arrGetRSP.push(strPrsRsParams.Items[i]);
                                }
                            } else {
                                var strPrsRsParams = strRSParams;
                                strLogInfo = strLogInfo;
                                for (i = 0; i < strPrsRsParams.Items.length; i++) {
                                    arrGetRSP.push(strPrsRsParams.Items[i]);
                                }
                            }

                            _SaveContent(arrGetRSP);
                        }

                    } catch (error) {
                        printError(error)
                    }
                }

                function GetTargetTableAndKeyColumn(pRelationJson, pDTTCode) {
                    var tmpStr = ''
                    for (var i = 0; i < pRelationJson.length; i++) {
                        tmpStr = _GetHierarchyDTT(pRelationJson[i], pDTTCode)
                        if (tmpStr != undefined && tmpStr != '')
                            break
                    }
                    return tmpStr
                }

                function _GetHierarchyDTT(pRelationJson, pDTTCode) {
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
                            return strTargetTable + ',' + strKeyColumn + ',' + strDTTDescription + ',' + strDTTCategory
                        }

                        // find on child dtt relation
                        for (var i = 0; i < objRelationJson.CHILD_DTT_RELEATIONS.length; i++) {
                            if (objRelationJson.CHILD_DTT_RELEATIONS[i].DTT_CODE == pDTTCode) {
                                strTargetTable = objRelationJson.CHILD_DTT_RELEATIONS[i]['TARGET_TABLE']
                                strKeyColumn = objRelationJson.CHILD_DTT_RELEATIONS[i]['PRIMARY_COLUMN']
                                strDTTDescription = objRelationJson.CHILD_DTT_RELEATIONS[i]['DTT_DESCRIPTION']
                                strDTTCategory = objRelationJson.CHILD_DTT_RELEATIONS[i]['CATEGORY']
                                return strTargetTable + ',' + strKeyColumn + ',' + strDTTDescription + ',' + strDTTCategory
                            }
                            _GetHierarchyDTT(objRelationJson.CHILD_DTT_RELEATIONS[i], pDTTCode, pLogInfo)
                        }
                    } catch (ex) {
                        console.log('Error on finding targettable and keycolumn ' + ex)

                    }
                }


                function _SaveContent(arrGetRSP) {
                    try {

                        if (strRSParams != '') {

                            strGroupId = 'GRP_' + strLogInfo.USER_ID + ((Date.now() * 10000) + 621355968000000000);
                            for (i = 0; i < arrGetRSP.length; i++) {
                                var strRSPAtmtDttCode = arrGetRSP[i].ATMT_DTT_CODE;
                                var strRSPTrnId = arrGetRSP[i].TRN_ID;
                                if (strSource == 'SCAN') {
                                    strTrnId = strRSPTrnId;
                                }

                                arrRSPItem = [];
                                arrRSPItem.push(arrGetRSP[i]);
                                if (arrGetRSP[i].AT_CODE != '') {
                                    _GetATDescription();
                                }
                                if (arrGetRSP[i].DTTA_ID != '') {
                                    _GetAttachmentTitle();
                                } else if (arrGetRSP[i].DTTA_ID == '' || arrGetRSP[i].DTTA_ID == null || arrGetRSP[i].DTTA_ID == 0 || arrGetRSP[i].DTTA_ID == undefined) {
                                    _GetAttachmentTitle();
                                }
                                if (strRSPTrnId != '' && strRSPAtmtDttCode != '') {
                                    _InsertTran();
                                }
                                if (strRSPTrnId != '' && (strRSPAtmtDttCode == '' || strRSPAtmtDttCode == null || strRSPAtmtDttCode == undefined)) {
                                    _InsATMT();
                                }
                                if (strRSPTrnId == '' && strChkTrnId == '') {
                                    _InsertTran();
                                }
                                if (strRSPTrnId == '' && strChkTrnId != '') {
                                    _InsATMT();
                                }


                                break;
                            }
                        }

                    } catch (error) {
                        printError(error)
                    }
                }
                var pLogInfo = null;





                function _InsertTran() {
                    try {

                        var strDTTCATEGORY = '';
                        var strDTTDESCRIPTION = '';
                        var strDTTCODE = '';
                        var strTARGETTABLE = '';
                        var strPRIMARYCOLUMN = '';
                        var strAtmtDttCD = arrRSPItem[0].ATMT_DTT_CODE;
                        if (strTrnId != 0) {
                            _InsATMT();
                        } else if (strTrnId == 0 && strChkTrnId == 0) {
                            var strTemp = GetTargetTableAndKeyColumn(strRelJson, strDttCode)
                            var strDTTInfo = strTemp.split(',')
                            strDTTCATEGORY = strDTTInfo[3];
                            strDTTDESCRIPTION = strDTTInfo[2];
                            strDTTCODE = strDttCode;
                            strTARGETTABLE = strDTTInfo[0];
                            strPRIMARYCOLUMN = strDTTInfo[1];
                        } else if (strTrnId == 0 && strChkTrnId != 0 && strAtmtDttCD != '') {
                            var strTemp = GetTargetTableAndKeyColumn(strRelJson, strAtmtDttCD)
                            var strDTTInfo = strTemp.split(',')
                            strDTTCATEGORY = strDTTInfo[3];
                            strDTTDESCRIPTION = strDTTInfo[2];
                            strDTTCODE = strAtmtDttCD;
                            strTARGETTABLE = strDTTInfo[0];
                            strPRIMARYCOLUMN = strDTTInfo[1];
                        }

                        var arrTableIns = [];
                        var objTabValue = {};
                        if (strSource == 'SCAN') {
                            if (arrRSPItem[0].ATMT_DTT_CODE == '') {

                                if (strParentKeyColumn != '' && strParentKeyValue != '') {
                                    objTabValue[strParentKeyColumn] = strParentKeyValue;
                                }
                            }
                        }
                        var jtokenvalue = dynamicresult.LOADDYANMICDATA;
                        for (var i = 0; i < jtokenvalue.length; i++) {
                            controlnameres = jtokenvalue[i].CONTROL_NAME;
                            var arrcontrolname = controlnameres.split('~');
                            if (arrcontrolname[0].toLowerCase() == 'dte') {
                                controlname = arrcontrolname[1];
                                controlvalue = jtokenvalue[i].CONTROL_VALUE;
                                var dt = new Date(controlvalue);
                                objTabValue[controlname] = dt;
                            } else {
                                controlname = arrcontrolname[1];
                                controlvalue = jtokenvalue[i].CONTROL_VALUE;
                                objTabValue[controlname] = controlvalue;

                            }
                        }
                        //   objTabValue.CREATED_BY = strLogInfo.USER_ID;
                        //  objTabValue.CREATED_BY_NAME = strLogInfo.USER_NAME;
                        //     objTabValue.SYSTEM_NAME = strLogInfo.SYSTEM_DESC;
                        //  objTabValue.DT_DESCRIPTION = strDtDesc;
                        objTabValue.CREATED_BY = '54';
                        objTabValue.CREATED_BY_NAME = 'NLIC';
                        objTabValue.DT_DESCRIPTION = 'NLIC Claim Automation';
                        objTabValue.SYSTEM_NAME = 'Badr-Barka';
                        objTabValue.SYSTEM_ID = strLogInfo.SYSTEM_ID;
                        objTabValue.CREATED_DATE = new Date();
                        if(reqdata.body.scantype=="PENDING"){
                            objTabValue.STATUS = 'PENDING';
                        }else if(reqdata.body.scantype=="SCANNED"){
                             objTabValue.STATUS = 'SCANNED';
                        }else if(reqdata.body.scantype=="SCAN"){
                             objTabValue.STATUS = 'COMPLETED';
                        }else{
                            objTabValue.STATUS = 'CREATED';
                        }
                        objTabValue.PROCESS_STATUS = 'CREATED';
                        objTabValue.DT_CODE = strDtCode;


                        if (arrRSPItem[0].ATMT_DTT_CODE != '') {
                            //      objTabValue.SPU_ID = strspuid;
                            objTabValue.DTT_CODE = arrRSPItem[0].ATMT_DTT_CODE;
                            objTabValue.DTT_DESCRIPTION = strDTTDESCRIPTION;
                        } else {
                            objTabValue.DTT_CODE = strDttCode;
                            objTabValue.DTT_DESCRIPTION = strDTTDESCRIPTION;
                        }
                        objTabValue.PRCT_ID = reqUuid.v1();
                        objTabValue.VERSION_NO = '0';
                        objTabValue.MODIFIED_BY = strLogInfo.USER_ID;
                        objTabValue.MODIFIED_DATE = new Date();
                        arrTableIns.push(objTabValue);



                        reqTranDBHelper.InsertTranDBWithAudit(mTranDB, strTARGETTABLE, arrTableIns, pLogInfo, function(pResult) {
                            try {

                                if (pResult) {
                                    console.log('Target Table Inseted');
                                    var result = pResult[0];
                                    var strPrimaryCol = result[strPRIMARYCOLUMN.toLowerCase()];
                                    _InsTranset(strPrimaryCol, result);
                                } else {
                                    // reqTranDBHelper.Commit(mTranDB, false);
                                }
                            } catch (error) {
                                printError(error);
                                successcallback('FAILURE');
                            }

                        })


                    } catch (error) {
                        printError(error)
                    }
                }

                //Transactionset table insert
                function _InsTranset(pPrimaryCol, pRes) {
                    try {

                        strChkTrnId = strTrnId;
                        var arrTableIns = [];
                        var objTabValue = {};
                        // objTabValue.CREATED_BY = strLogInfo.USER_ID;
                        // objTabValue.CREATED_BY_NAME = strLogInfo.USER_NAME;
                        // objTabValue.SYSTEM_NAME = strLogInfo.SYSTEM_DESC;
                        objTabValue.CREATED_BY = '54';
                        objTabValue.CREATED_BY_NAME = 'NLIC';
                        objTabValue.DT_DESCRIPTION = 'NLIC Claim Automation';
                        objTabValue.SYSTEM_NAME = 'Badr-Barka';
                        objTabValue.SYSTEM_ID = strLogInfo.SYSTEM_ID;
                        objTabValue.CREATED_DATE = new Date();
                        objTabValue.STATUS = 'CREATED';
                        objTabValue.PROCESS_STATUS = 'CREATED';
                        objTabValue.DT_CODE = strDtCode;
                        //   objTabValue.DT_DESCRIPTION = strDtDesc;
                        objTabValue.DTT_CODE = pRes.dtt_code;
                        objTabValue.DTT_DESCRIPTION = pRes.dtt_description;
                        objTabValue.PRCT_ID = reqUuid.v1();
                        objTabValue.VERSION_NO = '0';
                        objTabValue.MODIFIED_BY = strLogInfo.USER_ID;
                        objTabValue.MODIFIED_DATE = new Date();
                        objTabValue.TRN_ID = pPrimaryCol;
                        objTabValue.GROUP_ID = strGroupId;
                        arrTableIns.push(objTabValue);


                        reqTranDBHelper.InsertTranDBWithAudit(mTranDB, 'TRANSACTION_SET', arrTableIns, pLogInfo, function(pResult) {
                            try {
                                if (pResult) {
                                    console.log('TRANSACTION_SET Table Inserted');
                                    var res = pResult[0]
                                    strAtmtTsId = res.ts_id;
                                    strAtmtTRNId = res.trn_id;
                                    strChkTrnId = res.trn_id;

                                    if (strTrnId != 0 && pPrimaryCol != '') {
                                        _InsATMT();
                                    } else if (strTrnId == 0 && (arrRSPItem[0].ATMT_DTT_CODE == '' || arrRSPItem[0].ATMT_DTT_CODE == null || arrRSPItem[0].ATMT_DTT_CODE == undefined)) {
                                        _InsATMT();
                                    } else if (strTrnId == 0 && strChkTrnId != 0 && (arrRSPItem[0].ATMT_DTT_CODE != '' || arrRSPItem[0].ATMT_DTT_CODE != null || arrRSPItem[0].ATMT_DTT_CODE != undefined)) {
                                        if (strSource == 'SCAN') {
                                            _InsATMT();
                                        } else {
                                            _InsertTran();
                                        }
                                    }
                                } else {
                                    //   reqTranDBHelper.Commit(mTranDB, false);
                                }

                            } catch (error) {
                                printError(error)
                            }

                        })


                    } catch (error) {
                        printError(error)
                    }
                }
                // Insert Attachment table
                function _InsATMT() {
                    try {
                        var arrTableIns = [];
                        var objTabValue = {};
                        objTabValue.RELATIVE_PATH = arrRSPItem[0].RELATIVE_PATH;
                        objTabValue.ORIGINAL_FILE_NAME = arrRSPItem[0].FILE_NAME;
                        objTabValue.FILE_SIZE = arrRSPItem[0].FILE_SIZE;
                        objTabValue.RESOURCE_SERVER_CODE = arrRSPItem[0].RS_CODE;
                        if (arrRSPItem[0].AT_CODE != '') {
                            objTabValue.AT_CODE = arrRSPItem[0].AT_CODE;
                        } else {
                            objTabValue.AT_CODE = 'UNKNOWN';
                        }
                        objTabValue.COMMENT_TEXT = arrRSPItem[0].COMMENT;
                        objTabValue.ATMT_DTT_CODE = arrRSPItem[0].ATMT_DTT_CODE;
                        if (arrRSPItem[0].DTTA_ID != 0) {
                            objTabValue.DTTA_ID = arrRSPItem[0].DTTA_ID;
                        } else {
                            objTabValue.DTTA_ID = strDttaId;
                        }
                        if (arrRSPItem[0].DTTAD_ID != 0) {
                            objTabValue.DTTAD_ID = arrRSPItem[0].DTTAD_ID;
                        } else {
                            objTabValue.DTTAD_ID = strDttadId;
                        }
                        objTabValue.DTTADIF_ID = arrRSPItem[0].DTTADIF_ID;
                        objTabValue.DTTAC_DESC = arrRSPItem[0].DTTAC_DESC;
                        if (arrRSPItem[0].ATMT_DTT_CODE != '') {
                            objTabValue.ATMT_TS_ID = strAtmtTsId;
                            objTabValue.ATMT_TRN_ID = strAtmtTRNId;
                        } else {
                            objTabValue.ATMT_TS_ID = '0';
                            objTabValue.ATMT_TRN_ID = '0';
                        }

                        objTabValue.AT_DESCRIPTION = strATDesc;
                        objTabValue.ATTACHMENT_TITLE = strAttachTitle;
                        objTabValue.checked_out_by_name = 'CREATED'
                        objTabValue.TOTAL_PAGES = '0';
                        objTabValue.IS_CURRENT = 'Y';
                        objTabValue.IS_DELETED = 'N';
                        objTabValue.SOURCE = strSource;
                        objTabValue.SOURCE_DETAILS = strSourceDet;
                        objTabValue.CREATED_BY = strLogInfo.USER_ID;
                        objTabValue.CREATED_BY_NAME = strLogInfo.USER_NAME;
                        objTabValue.SYSTEM_ID = strLogInfo.SYSTEM_ID;
                        objTabValue.SYSTEM_NAME = strLogInfo.SYSTEM_DESC;
                        objTabValue.CREATED_DATE = new Date();
                        objTabValue.DT_CODE = strDtCode;
                        objTabValue.DTT_CODE = strDttCode;
                        if (arrRSPItem[0].ATMT_DTT_CODE != '' && strSource == 'SCAN') {
                            objTabValue.DTT_CODE = strFolderdttcode;
                        }
                        if (objTabValue.DTT_CODE == '') {
                            objTabValue.DTT_CODE = arrRSPItem[0].ATMT_DTT_CODE;
                        }

                        objTabValue.VERSION_NO = '0';
                        objTabValue.MODIFIED_BY = strLogInfo.USER_ID;
                        objTabValue.MODIFIED_DATE = new Date();

                        if (strTrnId == '') {
                            objTabValue.TRN_ID = strChkTrnId;
                        } else {
                            objTabValue.TRN_ID = strTrnId;
                        }
                        // if (arrRSPItem[0].ATMT_DTT_CODE != '' && strSource == 'SCAN') {
                        //     objTabValue.TRN_ID = strfoldertrn_id;
                        // }
                        objTabValue.GROUP_ID = strGroupId;
                        arrTableIns.push(objTabValue);

                        reqTranDBHelper.InsertTranDBWithAudit(mTranDB, 'TRN_ATTACHMENTS', arrTableIns, pLogInfo, function(pResult) {
                            try {
                                if (pResult) {
                                    console.log('TRN_ATTACHMENTS Table Inserted');
                                    arrGetRSP.shift();
                                    if (arrGetRSP.length > 0) {
                                        _SaveContent(arrGetRSP)
                                    } else {
                                        var strResult = 'SUCCESS';
                                        // reqTranDBHelper.Commit(mTranDB, true);
                                        successcallback(strResult);


                                    }
                                } else {
                                    //    reqTranDBHelper.Commit(mTranDB, false);
                                }


                            } catch (error) {
                                printError(error)
                            }

                        })

                    } catch (error) {
                        printError(error)
                    }
                }

                function successcallback(strResult) {

                    pCallback(strResult);

                }

                function _GetATDescription() {
                    try {

                        var strATC = arrRSPItem[0].AT_CODE;
                        // mClient.execute(SELAT, [strATC], {
                        //     prepare: true
                        // }, function callbackSelA(pError, pResult) {
                        reqDBInstance.GetTableFromFXDB(mClient, 'ATTACHMENT_TYPES', ['at_code', 'at_description'], {
                            'at_code': strATC
                        }, objLogInfo, function(pError, pResult) {
                            if (pError) {
                                console.error(pError);
                            } else if (pResult) {
                                try {


                                    if (pResult.rows.length > 0) {
                                        strATDesc = pResult.rows[0].at_description;
                                    }
                                } catch (error) {
                                    printError(error)
                                }
                            }
                        })

                    } catch (error) {
                        printError(error)
                    }
                }

                function _GetAttachmentTitle() {
                    try {

                        // mClient.execute(SELDTTINFO, [strDttCode, strAppId], {
                        //     prepare: true
                        // }, function callbackSelA(pError, pResult) {
                        var conddtt = new Object();
                        conddtt.dtt_code = strDttCode;
                        conddtt.app_id = strAppId;
                        reqDBInstance.GetTableFromFXDB(mClient, 'DTT_INFO', ['app_id', 'dtt_code', 'dtt_description', 'dtt_dfd_json'], conddtt, objLogInfo, function(pError, pResult) {
                            if (pError) {
                                console.error(pError);
                            } else if (pResult) {
                                try {

                                    var strDttInfoDFDJson = pResult.rows[0].dtt_dfd_json.toString().replace(/\\/g, '');
                                    var strDttDfdJson2 = JSON.parse(strDttInfoDFDJson);
                                    var objDttAtmt = {};
                                    if (strDttDfdJson2.DTT_ATTACHMENT != '') {
                                        var strDttAtmt = strDttDfdJson2.DTT_ATTACHMENT;
                                        for (var i = 0; i < strDttAtmt.length; i++) {
                                            if (arrRSPItem[0].DTTA_ID == strDttAtmt[i].DTTA_ID) {
                                                strAttachTitle = strDttAtmt[i].ATTACH_TITLE;
                                                strDttaId = strDttAtmt[i].DTTA_ID;
                                                strDttadId = strDttAtmt[i].DTTAD_ID;
                                            }
                                        }
                                    }

                                } catch (error) {
                                    printError(error)
                                }
                            }
                        })

                    } catch (error) {
                        printError(error)
                    }
                }
            });
        });
    }

} catch (ex) {
    printError(ex)
}




function printError(pErr) {
    console.log(pErr.stack);
}
module.exports = {
    SaveList: SaveList
};