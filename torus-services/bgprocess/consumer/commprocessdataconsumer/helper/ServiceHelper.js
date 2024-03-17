/**
 * Api_Name         : /SendMessage
 * Description      : To send the communication like MAIL/SMS
 * Last ErrorCode   : ERR-COM-20078
 */

// Require dependencies

var reqBase64 = require('base64-js');
var reqLinq = require('node-linq').LINQ;
var reqTranDBHelper = require('../../../../../torus-references/instance/TranDBInstance');
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqAsync = require('async');
var reqFXDBInstance = require('../../../../../torus-references/instance/DBInstance');


// Get relation JSON
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
    } catch (error) {
        _PrintError(pLogInfo, 'Error on GetRelationJSON()', 'ERR-COM-20078', error);
    }
    return REL_JSON;
}

//get Redish connection
function _GetRedisKey(pKey, pCallback) {
    const constSession = 'SESSIONID-';
    pKey = constSession + pKey;
    reqInstanceHelper.GetConfig(pKey, function callbackGetRedisKey(pRes, pErr) {
        pCallback(pRes, pErr);
    });
}

// Get keycolumn 
function GetKeyColumn(pCasIns, pAppId, pDTCode, pDTTCode, pLogInfo, pCallback) {
    const DTINFO = 'SELECT RELATION_JSON FROM DT_INFO WHERE APP_ID=? AND DT_CODE=? ;';
    reqFXDBInstance.GetTableFromFXDB(pCasIns, 'DT_INFO', ['RELATION_JSON'], {
        APP_ID: pAppId,
        DT_CODE: pDTCode

    }, pLogInfo, function callback(pError, pResult) {
        if (pError)
            _PrintError(pLogInfo, 'Error on GetKeyColumn() ', 'ERR-COM-20021', pError);
        else {
            if (pResult.rows.length > 0) {
                var strRelationJson = pResult.rows[0]['relation_json'];
                var tmpstr = GetTargetTableAndKeyColumn(JSON.parse(strRelationJson), pDTTCode, pLogInfo);
                pCallback(tmpstr);
            }
        }
    });
}

// Get targettable , keycolumn and DTT Info
function GetTargetTableAndKeyColumn(pRelationJson, pDTTCode, pLogInfo) {
    var tmpStr = '';
    try {
        for (var i = 0; i < pRelationJson.length; i++) {
            tmpStr = _GetHierarchyDTT(pRelationJson[i], pDTTCode, pLogInfo);
            if (tmpStr != undefined && tmpStr != '')
                break;
        }
    } catch (erro) {
        _PrintError(pLogInfo, 'Error on GetTargetTableAndKeyColumn() ', 'ERR-COM-20022', error);
    }
    return tmpStr;
}

// Recursive function to get DTT info
function _GetHierarchyDTT(pRelationJson, pDTTCode, pLogInfo) {
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
            return strTargetTable + ',' + strKeyColumn + ',' + strDTTDescription + ',' + strDTTCategory;
        }

        // find on child dtt relation
        for (var i = 0; i < objRelationJson.CHILD_DTT_RELEATIONS.length; i++) {
            if (objRelationJson.CHILD_DTT_RELEATIONS[i].DTT_CODE == pDTTCode) {
                strTargetTable = objRelationJson.CHILD_DTT_RELEATIONS[i]['TARGET_TABLE'];
                strKeyColumn = objRelationJson.CHILD_DTT_RELEATIONS[i]['PRIMARY_COLUMN'];
                strDTTDescription = objRelationJson.CHILD_DTT_RELEATIONS[i]['DTT_DESCRIPTION'];
                strDTTCategory = objRelationJson.CHILD_DTT_RELEATIONS[i]['CATEGORY'];
                return strTargetTable + ',' + strKeyColumn + ',' + strDTTDescription + ',' + strDTTCategory;
            }
            _GetHierarchyDTT(objRelationJson.CHILD_DTT_RELEATIONS[i], pDTTCode, pLogInfo);
        }
    } catch (error) {
        _PrintError(pLogInfo, 'Error on _GetHierarchyDTT() - finding targettable and keycolumn ', 'ERR-COM-20023', error);
    }
}

// To get transaction data
function GetTRNDetails(pTranDB, pOrm, pDepCas, pTRNQuery, pAppId, pDTCode, pDTTCode, pWftpaId, pUid, pPrctId, pLogInfo, pTemplateInfo, psessionInfo, pCallback) {
    try {
        var static_data = getStaticData();

        function getStaticData() {
            var data = '';
            if (psessionInfo) {
                if (psessionInfo.staticCommProcessData) {
                    data = JSON.parse(psessionInfo.staticCommProcessData);
                    delete psessionInfo.staticCommProcessData;
                }
            }
            return data;
        }
        if (static_data) {
            var staticDataResult = {
                rows: [static_data]
            };
            _PrintInfo("This Collobration Group Has Static Data From COMM_PROCESS_DATA " + staticDataResult, pLogInfo);
            var objStatus = _PrepareCallbackObject('SUCCESS', null, null, null, null, null);
            pCallback(staticDataResult, pTemplateInfo, objStatus);
        } else {
            var Params = psessionInfo;
            if (Params.U_ID != undefined && Params.U_ID != '')
                mUID = Params.U_ID;

            if (Params.APP_STS_ID != undefined && Params.APP_STS_ID != '')
                mAppStsId = Params.APP_STS_ID;

            if (Params.S_ID != undefined && Params.S_ID != '')
                mSId = Params.S_ID;

            if (Params.APP_ID != undefined && Params.APP_ID != '')
                mAppId = Params.APP_ID;

            if (Params.APPU_ID != undefined && Params.APPU_ID != '')
                mAppUId = Params.APPU_ID;

            if (Params.APP_USER_ROLES != undefined && Params.APP_USER_ROLES != '')
                mAppRoles = Params.APP_USER_ROLES;

            if (Params.LOGIN_NAME != undefined && Params.LOGIN_NAME != '')
                mLoginName = Params.LOGIN_NAME;

            if (Params.S_DESC != undefined && Params.S_DESC != '')
                mSystemDesc = Params.S_DESC;

            if (Params.S_CODE != undefined && Params.S_CODE != '')
                mSCode = Params.S_CODE;


            if (pTRNQuery != undefined && pTRNQuery != '') {
                if (pTRNQuery.toString().indexOf("$TOKEN_ID") || pTRNQuery.toString().indexOf("$token_id"))
                    pTRNQuery = pTRNQuery.replaceAll("$TOKEN_ID", pPrctId);

                if (pTRNQuery.toString().indexOf("$U_ID") || pTRNQuery.toString().indexOf("$u_id"))
                    pTRNQuery = pTRNQuery.replaceAll("$U_ID", "'" + mUID + "'");

                if (pTRNQuery.toString().indexOf("$APP_USER_ROLES") || pTRNQuery.toString().indexOf("$app_user_roles"))
                    pTRNQuery = pTRNQuery.replaceAll("$APP_USER_ROLES", "'" + mAppRoles + "'");

                if (pTRNQuery.toString().indexOf("$APP_ID") || pTRNQuery.toString().indexOf("$app_id"))
                    pTRNQuery = pTRNQuery.replaceAll("$APP_ID", "'" + mAppId + "'");

                if (pTRNQuery.toString().indexOf("$S_ID") || pTRNQuery.toString().indexOf("$s_id"))
                    pTRNQuery = pTRNQuery.replaceAll("$S_ID", "'" + mSId + "'");

                if (pTRNQuery.toString().indexOf("$APPU_ID") || pTRNQuery.toString().indexOf("$appu_id"))
                    pTRNQuery = pTRNQuery.replaceAll("$APPU_ID", "'" + mAppUId + "'");

                if (pTRNQuery.toString().indexOf("$LOGIN_NAME") || pTRNQuery.toString().indexOf("$login_name"))
                    pTRNQuery = pTRNQuery.replaceAll("$LOGIN_NAME", "'" + mLoginName + "'");

                if (pTRNQuery.toString().indexOf("$S_DESC") || pTRNQuery.toString().indexOf("$s_desc"))
                    pTRNQuery = pTRNQuery.replaceAll("$S_DESC", "'" + mSystemDesc + "'");

                if (pTRNQuery.toString().indexOf("$S_CODE") || pTRNQuery.toString().indexOf("$s_code"))
                    pTRNQuery = pTRNQuery.replaceAll("$S_CODE", "'" + mSCode + "'");

                reqTranDBHelper.ExecuteSQLQuery(pTranDB, pTRNQuery, pLogInfo, function callback(pRes, pErr) {
                    var arr = [];
                    var objStatus = {};
                    if (pErr)
                        objStatus = _PrepareCallbackObject('FAILURE', null, 'ERR-COM-20024', 'Error on GetTRNDetails()', pErr, null);
                    else {
                        arr = pRes;
                        _PrintInfo("TRN_QRY result count:" + pRes.rows.length, pLogInfo);
                        objStatus = _PrepareCallbackObject('SUCCESS', null, null, null, null, null);
                    }
                    pCallback(arr, pTemplateInfo, objStatus);
                });

            } else {
                var objRes = {};
                objRes.rows = [];
                _PrintInfo("TRN_QRY result count", pLogInfo);
                objStatus = _PrepareCallbackObject('SUCCESS', null, null, null, null, null);
                pCallback(objRes, pTemplateInfo, objStatus);
            }
            // else {
            //     _GetCommunicationData(pTranDB, pOrm, pDepCas, pAppId, pWftpaId, pPrctId, "N", pUid, pDTCode, pDTTCode, pLogInfo, function callbcak(pRes) {
            //         var arr = [];
            //         if (pRes.Status == 'SUCCESS' && pRes.Data != undefined) {
            //             arr = pRes.Data;
            //             _PrintInfo("TRN_QRY result count:" + arr.rows.length, pLogInfo);
            //         } else {
            //             _PrintInfo("TRN_QRY result count: 0 ", pLogInfo);
            //         }
            //         pCallback(arr, pTemplateInfo, pRes);
            //     });
            // }
        }
    } catch (error) {
        var objStatus = _PrepareCallbackObject('FAILURE', 'ERR-COM-20025', 'Error on GetTRNDetails()', error, null);
        pCallback([], pTemplateInfo, objStatus);
    }
}

// If TRN_QRY not found, then prepare tran query and get communication data or Transaction data
function _GetCommunicationData(pTranDB, pOrm, pDepCas, pAppId, pWftpaId, pPRCTId, pFromScheduler, pUId, pDTCode, pDTTCode, pLogInfo, pCallback) {
    var obj = {};
    var qry = 'SELECT RELATION_JSON FROM DT_INFO WHERE APP_ID=? AND DT_CODE=? ;';
    try {
        reqFXDBInstance.GetTableFromFXDB(pDepCas, 'DT_INFO', ['RELATION_JSON'], {
            APP_ID: pAppId,
            DT_CODE: pDTCode
        }, pLogInfo, function callbackGetTableFromFXDB(pError, pResult) {
            if (pResult) {
                if (pResult.rows.length > 0) {
                    var objRelationJson = JSON.parse(pResult.rows[0]['relation_json']);
                    var strTemp = GetTargetTableAndKeyColumn(objRelationJson, pDTTCode);
                    var arrDTTInfo = strTemp.split(',');
                    var TargetTable = arrDTTInfo[0];
                    var EntityKeyColumn = arrDTTInfo[1];
                    if (TargetTable != '' && EntityKeyColumn != '') {
                        var v_QueryString = '';
                        v_QueryString = "SELECT DISTINCT TT.* FROM " + TargetTable.trim() + " TT   INNER JOIN COMM_PROCESS_DATA CPD ON CPD.TRN_ID = TT." + EntityKeyColumn.trim();

                        if (pDTCode != '')
                            v_QueryString = v_QueryString + " AND CPD.DT_CODE =  '" + pDTCode + "'";

                        if (pDTTCode != '')
                            v_QueryString = v_QueryString + " AND CPD.DTT_CODE =   '" + pDTTCode + "'";

                        if (pPRCTId != '')
                            v_QueryString = v_QueryString + " AND CPD.PRCT_ID =   '" + pPRCTId + "'";

                        if (pWftpaId != '')
                            v_QueryString = v_QueryString + " AND CPD.WFTPA_ID =   '" + pWftpaId + "'";

                        reqTranDBHelper.ExecuteSQLQuery(pTranDB, v_QueryString, pLogInfo, function callback(pRes, pErr) {
                            if (pErr)
                                obj = _PrepareCallbackObject('FAILURE', null, 'ERR-COM-20026', 'Error on executing TRAN qry', pErr, null);
                            else
                                obj = _PrepareCallbackObject('SUCCESS', pRes, '', null, null, null);
                            pCallback(obj);
                        });
                    } else {
                        obj = _PrepareCallbackObject('FAILURE', null, 'ERR-COM-20027', null, null, 'Error on _GetCommunicationData() - TargetTable not found');
                        pCallback(obj);
                    }
                } else {
                    obj = _PrepareCallbackObject('FAILURE', null, 'ERR-COM-20028', null, null, 'Error on _GetCommunicationData() - No DT_INFO Found for DT_CODE');
                    pCallback(obj);
                }
            } else {
                obj = _PrepareCallbackObject('FAILURE', null, 'ERR-COM-20028', null, null, 'Error on _GetCommunicationData() - No DT_INFO Found for DT_CODE');
                pCallback(obj);
            }
        });
    } catch (error) {
        obj = _PrepareCallbackObject('FAILURE', null, 'ERR-COM-20029', 'Error on _GetCommunicationData()', error, null);
        pCallback(obj);
    }
}

// To get statis and dynamic attachments to send
function GetAttachments(pTranDB, pResCas, pDepCas, pTRNAQuery, pCommTemplt, pAppId, pDTCode, pDTTCode, pWftpaId, pUid, pPrctId, pAtmtData, pLogInfo, pCallback) {
    var arrAtt = [];
    var obj = {};
    try {
        // reqAsync.parallel({
        // StaticAtt: function (parCb) {
        //     // Get Static attachments
        //     var qry = 'SELECT * FROM COMM_STATIC_ATTACHMENTS WHERE COMMMT_CODE=? ALLOW FILTERING;'
        //     reqFXDBInstance.GetTableFromFXDB(pDepCas, 'COMM_STATIC_ATTACHMENTS', [], {
        //         COMMMT_CODE: pCommTemplt

        //     }, pLogInfo, function callbackGetTableFromFXDB(pError, pResult) {
        //         obj = {};
        //         if (pError)
        //             obj = _PrepareCallbackObject('FAILURE', null, 'ERR-COM-20030', 'Error on getting static attachment', pError, null)
        //         if (pResult) {
        //             for (var i = 0; i < pResult.rows.length; i++) {
        //                 var strB64 = pResult.rows[i]['static_attachment'];
        //                 var byt = reqBase64.toByteArray(strB64)
        //                 _AddAttachments(arrAtt, pResult.rows[i]['static_attachment_name'], byt, 0)
        //             }
        //             obj = _PrepareCallbackObject('SUCCESS', null, '', '', null, null)
        //         }
        //         parCb(pError, obj)
        //     })
        // },
        // DynamicAtt: function (parCb) {
        // pTRNAQuery = "select * from TRN_ATTACHMENTS  where trna_id='39512'";
        if (pTRNAQuery != undefined && pTRNAQuery != '') { // TRANA Qry found
            // if trana query found, get attachment from query
            if (pTRNAQuery.toString().indexOf("$TOKEN_ID") > 0 || pTRNAQuery.toString().indexOf("$token_id") > 0)
                pTRNAQuery = pTRNAQuery.toUpperCase().replaceAll("$TOKEN_ID", pPrctId);

            if (pAtmtData != null && pAtmtData != undefined) {
                if (pAtmtData.length > 0) {
                    var s = '';
                    if (pAtmtData[0]['trna_id'] != null && pAtmtData[0]['trna_id'] != undefined) {
                        //Attachment level - get selected attachment
                        var arr = [];
                        for (var i = 0; i < pAtmtData.length; i++)
                            arr.push(pAtmtData[i]['trna_id']);
                        pTRNAQuery = pTRNAQuery.toUpperCase().replace("$TRNA_ID", arr.join());
                    } else if (pAtmtData[0]['trn_id'] != null && pAtmtData[0]['trn_id'] != undefined) // Folder level -get all attahment against on folder
                    {
                        var arr = [];
                        for (var i = 0; i < pAtmtData.length; i++)
                            arr.push(pAtmtData[i]['trn_id']);
                        pTRNAQuery = pTRNAQuery.toUpperCase().replace("$TRN_ID", arr.join());
                    } else {
                        var arr = [];
                        var strKeyCol = pAtmtData[0]['key_column'];
                        for (var i = 0; i < pAtmtData.length; i++)
                            arr.push(pAtmtData[i][strKeyCol]);
                        pTRNAQuery = pTRNAQuery.toUpperCase().replace("$TRN_ID", arr.join());
                    }
                }
            }
            reqTranDBHelper.ExecuteSQLQuery(pTranDB, pTRNAQuery, pLogInfo, function callback(pRes, pErr) {
                var count = 0;
                if (pErr) {
                    obj = _PrepareCallbackObject('FAILURE', [], 'ERR-COM-20031', 'Error on executing TRNA_QRY', pErr, null);
                    pCallback(obj);
                } else if (pRes) {
                    if (pRes.rows.length == 0) {
                        pCallback(arrAtt);
                    } else {
                        obj = _PrepareCallbackObject('SUCCESS', pRes, '', '', '', '');
                        pCallback(obj);
                    }


                    // for (var i = 0; i < pRes.rows.length; i++) {
                    //     var TrnAttRow = pRes.rows[i];
                    //     _GetAttachmentfromRS(pResCas, TrnAttRow, arrAtt, pLogInfo, function callbackGetAttachmentfromRS(pByte, pTrnAttRow) {
                    //         count++;
                    //         if (pByte != undefined && pByte != null && pByte.length > 0) {
                    //             var arrByt = pByte;
                    //             _AddAttachments(arrAtt, pTrnAttRow['original_file_name'], arrByt, pTrnAttRow['trn_id']);
                    //         } else
                    //             _PrintError(pLogInfo, 'Attachment not found for ' + pTrnAttRow['relative_path'], 'ERR-COM-20032', null);
                    //         if (pRes.rows.length == count) {
                    //             obj = _PrepareCallbackObject('SUCCESS', arrAtt, null, null, null, null);
                    //             parCb(null, obj);
                    //         }
                    //     });
                    // }
                }
            });
        } else {
            obj = _PrepareCallbackObject('SUCCESS', [], '', '', '', '');
            pCallback(obj);

            //     // TRANA Qry not found
            //     var obj = {};
            //     _GetTRNAQuery(pTranDB, pAtmtData, pPrctId, '', pLogInfo, function callbackGetTRNAQuery(pStatusLst) {
            //         if (pStatusLst.Status == 'SUCCESS') {
            //             var pLst = pStatusLst.Data;
            //             var count = 0;
            //             if (pLst) {
            //                 if (pLst.rows.length == 0) {
            //                     obj = _PrepareCallbackObject('SUCCESS', arrAtt, null, null, null, null);
            //                     parCb(null, obj);
            //                 }
            //                 for (var i = 0; i < pLst.rows.length; i++) {
            //                     var dr = pLst.rows[i];
            //                     _GetAttachmentfromRS(pResCas, dr, arrAtt, pLogInfo, function callback(pByt, pTrnAttRow) {
            //                         count++;
            //                         if (pByt != undefined && pByt != null && pByt.length > 0) {
            //                             var arrByt = pByt;
            //                             _AddAttachments(arrAtt, pTrnAttRow['original_file_name'], arrByt, pTrnAttRow['trn_id']);
            //                         } else
            //                             _PrintError(pLogInfo, 'Attachment not found for ' + pTrnAttRow['relative_path'], 'ERR-COM-20033', null);
            //                         if (count == pLst.rows.length) {
            //                             obj = _PrepareCallbackObject('SUCCESS', arrAtt, null, null, null, null);
            //                             return parCb(null, obj);
            //                         }
            //                     });
            //                 }
            //             } else
            //                 parCb(null, pStatusLst);
            //         } else //pStatusLst.Status == 'FAILURE'
            //             parCb(null, pStatusLst);
            //     });
            // }
        }
        // },
        //     function (err, res) {
        //         var obj = {};
        //         if (res.DynamicAtt.Status != 'SUCCESS')
        //             return pCallback(res.DynamicAtt);
        //         else if (res.StaticAtt.Status != 'SUCCESS')
        //             return pCallback(res.StaticAtt);
        //         else
        //             obj = _PrepareCallbackObject('SUCCESS', arrAtt, null, null, null, null);
        //         return pCallback(obj);
        //     });
    } catch (error) {
        var obj = _PrepareCallbackObject('FAILURE', null, 'ERR-COM-20034', 'Error on GetAttachments()', error, null);
        return pCallback(obj);
    }
}

// To prepare TRANA Qry and execute the TRANA qry
function _GetTRNAQuery(pTranDB, pAtmtData, pPrctId, pOrm, pLogInfo, pCallback) {
    var obj = {};
    try {
        var TRNAQUERY = "SELECT TRNA.* FROM TRN_ATTACHMENTS TRNA INNER JOIN COMM_PROCESS_DATA CPD ON TRNA.TRN_ID=CPD.TRN_ID AND TRNA.DT_CODE=CPD.DT_CODE AND TRNA.DTT_CODE=CPD.DTT_CODE AND CPD.PRCT_ID='" + pPrctId + "'";
        if (pAtmtData) {
            if (pAtmtData.length > 0) {
                var s = '';
                if (pAtmtData[0]['trna_id'] != undefined && pAtmtData[0]['trna_id'] != null) {
                    // Attachment level -get selected attachment
                    var arr = [];
                    for (var i = 0; i < pAtmtData.length; i++)
                        arr.push(pAtmtData[i]['trna_id']);

                    TRNAQUERY = TRNAQUERY + " AND TRNA.TRNA_ID IN (" + arr.join() + ")";
                } else if (pAtmtData[0]['trn_id'] != null && pAtmtData[0]['trn_id'] != undefined) {
                    // Folder level -get all attahment against on folder{ // Folder level -get all attahment against on folder
                    var arr = [];
                    for (var i = 0; i < pAtmtData.length; i++)
                        arr.push(pAtmtData[i]['trn_id']);
                    TRNAQUERY = TRNAQUERY + " AND TRNA.TRN_ID IN (" + arr.join() + ")";
                } else {
                    var arr = [];
                    var strKeyColumn = pAtmtData[0]['key_column'];
                    for (var i = 0; i < pAtmtData.length; i++)
                        arr.push(pAtmtData[i][strKeyColumn]);
                    TRNAQUERY = TRNAQUERY + " AND TRNA.TRN_ID IN (" + arr.join() + ")";
                }

                reqTranDBHelper.ExecuteSQLQuery(pTranDB, TRNAQUERY, pLogInfo, function callback(pResult, pError) {
                    if (pError)
                        obj = _PrepareCallbackObject('FAILURE', null, 'ERR-COM-20035', 'Error on executing TRN_ATTACHMENTS query', pError, null);
                    else {
                        _PrintInfo("TRNA_QRY result count:" + pResult.rows.length, pLogInfo);
                        obj = _PrepareCallbackObject('SUCCESS', pResult, '', null, null, null);
                    }
                    return pCallback(obj);
                });
            }
        } else {
            obj = _PrepareCallbackObject('SUCCESS', null, 'ERR-COM-20036', null, null, 'ATMT_DATA not found');
            return pCallback(obj);
        }
    } catch (error) {
        obj = _PrepareCallbackObject('FAILURE', null, 'ERR-COM-20037', 'Error on _GetTRNAQuery() ', error, null);
        return pCallback(obj);
    }
}

// To get emailid / mobileno based on user / role based
function GetEmailIDFromFXDB(pCltCas, pData, pContactInfos, pAppID, pClientID, pType, pLogInfo, pCallback) {
    try {
        if (pContactInfos.length > 0 && pContactInfos[0]['COLUMN_NAME'] && pContactInfos[0]['COLUMN_NAME'].split('|')[0] === 'USERS') {
            _PrintInfo('Getting contact info using USER mode', pLogInfo);
            _GetUserBasedCommInfo(pCltCas, pContactInfos[0]['COLUMN_NAME'], pData, pContactInfos, pType, pLogInfo, function callbackGetUsersCommunicationDetail(paramData, paramContacts, pStatus) {
                _PrepareCallbackObject('');
                pCallback(paramData, paramContacts, pStatus);
            });
        } else if (pContactInfos.length > 0 && pContactInfos[0]['COLUMN_NAME'] && pContactInfos[0]['COLUMN_NAME'].split('|')[0] === 'ROLES') {
            _PrintInfo('Getting contact info using ROLE mode', pLogInfo);
            _GetRoleBasedCommInfo(pCltCas, pAppID, pClientID, pContactInfos[0]['COLUMN_NAME'], pData, pContactInfos, pType, pLogInfo, function callbackGetUsersCommunicationDetail(paramData, paramContacts, pStatus) {
                pCallback(paramData, paramContacts, pStatus);
            });
        } else {
            _PrintInfo('None of USER/ROLE mode asked for contact info', pLogInfo);
            var obj = _PrepareCallbackObject('SUCCESS', null, null, null, null, null);
            pCallback(pData, pContactInfos, obj);
        }
    } catch (error) {
        var obj = _PrepareCallbackObject('FAILURE', null, 'ERR-COM-20038', 'Error on GetEmailIDFromFXDB()', error, null);
        pCallback(null, null, obj);
    }
}

// To get user based communication info like EmailID/ MobileNo
function _GetUserBasedCommInfo(pCltCas, pColumnName, pData, pContactInfos, pType, pLogInfo, pCallback) {
    //pContact.COLUMN_NAME  - > USERS|LOGIN_NAME:LOGIN_NAME
    //                      - > USERS|TableFieldName to Query:ColumnName in TrnQry
    var obj = {};
    try {
        if (pColumnName != '' && pData != null && pData != undefined) {

            var strTemp = pColumnName.split('|')[1];
            var strTableFieldName = strTemp.split(':')[0];
            var strColumnInTrnQry = strTemp.split(':')[1];


            var strColumn = '';
            var strUsrQry = '';
            if (pType.toUpperCase() == 'MAIL') {
                strUsrQry = 'SELECT EMAIL_ID FROM USERS WHERE ' + strTableFieldName + ' IN ? ;';
                strColumn = 'EMAIL_ID';
            } else {
                strUsrQry = 'SELECT MOBILE_NO FROM USERS WHERE ' + strTableFieldName + ' IN ? ;';
                strColumn = 'MOBILE_NO';
            }

            reqAsync.forEach(pData, function (row, callbackSer) {
                var objCond = {};
                objCond[strTableFieldName] = row[strColumnInTrnQry.toLowerCase()].split(',');
                reqFXDBInstance.GetTableFromFXDB(pCltCas, 'USERS', [strColumn], objCond, pLogInfo, function callback(pError, pResult) {
                    if (pError)
                        _PrintError(pLogInfo, 'Error on _GetUserBasedCommInfo() ', 'ERR-COM-20039', pError);
                    else if (pResult) {
                        var arrUsers = new reqLinq(pResult.rows).Select(function (user) {
                            return user[strColumn.toLowerCase()];
                        }).ToArray();
                        row[strColumn.toLowerCase()] = arrUsers.join();
                    }
                    callbackSer();
                });
            },
                function () {
                    pContactInfos[0]['COLUMN_NAME'] = strColumn.toLowerCase();
                    obj = _PrepareCallbackObject('SUCCESS', null, null, null, null, null);
                    pCallback(pData, pContactInfos, obj);
                });
        } else {
            obj = _PrepareCallbackObject('FAILURE', null, 'ERR-COM-20040', null, null, 'ColumnName not found in contactinfo');
            pCallback(pData, pContactInfos, obj);
        }
    } catch (error) {
        obj = _PrepareCallbackObject('FAILURE', null, 'ERR-COM-20041', 'Error on _GetUserBasedCommInfo() ', error, null);
        pCallback(pData, pContactInfos, obj);
    }
}

// To get role based communication info like EmailID/ MobileNo
function _GetRoleBasedCommInfo(pCltCas, pAppID, pClientID, pColumnName, pData, pContactInfos, pType, pLogInfo, pCallback) {
    //pContact.COLUMN_NAME  - > ROLES|ROLE_CODE:ROLE_CODE
    //                      - > ROLES|TableFieldName for Query purpose : ColumnName in TrnQry to get values
    var obj = {};
    try {
        if (pColumnName != '' && pData != null && pData != undefined) {
            var arrAppRoles = [];
            var arrAppUserRoles = [];
            var strTemp = pColumnName.split('|')[1];
            var strTableFieldName = strTemp.split(':')[0];
            var strColumnInTrnQry = strTemp.split(':')[1];


            var strColumn = '';
            var strUsrQry = '';
            var strAppRoles = 'SELECT APPR_ID, ROLE_CODE, ROLE_DESCRIPTION FROM APP_ROLES WHERE APP_ID=?';
            var strAppUserRole = 'SELECT APPU_ID, APPUR_ID,APPR_ID FROM APP_USER_ROLES';
            var strAppUsers = 'SELECT U_ID, APPU_ID FROM APP_USERS WHERE APP_ID= ? AND APPU_ID= ? ALLOW FILTERING ;';
            if (pType.toUpperCase() == 'MAIL') {
                strUsrQry = "SELECT EMAIL_ID FROM USERS WHERE U_ID= ? AND CLIENT_ID=?  ALLOW FILTERING ;";
                strColumn = 'EMAIL_ID';
            } else {
                strUsrQry = "SELECT MOBILE_NO FROM USERS WHERE U_ID= ? AND CLIENT_ID=?  ALLOW FILTERING ;";
                strColumn = 'MOBILE_NO';
            }


            //GetAppRoles
            reqFXDBInstance.GetTableFromFXDB(pCltCas, 'APP_ROLES', ['APPR_ID', 'ROLE_CODE', 'ROLE_DESCRIPTION'], {
                APP_ID: pAppID
            }, pLogInfo, function callback(pError, pResult) {
                arrAppRoles = pResult.rows;
                reqFXDBInstance.GetTableFromFXDB(pCltCas, 'APP_USER_ROLES', ['APPU_ID', 'APPUR_ID', 'APPR_ID'], {}, pLogInfo, function callbackGetTableFromFXDB(pError, pResult) {
                    arrAppUserRoles = pResult.rows;

                    reqAsync.forEach(pData, function (pRow, callbackData) {
                        var arrEmailIDs = [];
                        var arr = [];
                        var arrTmpAppuRole = [];
                        // Spli more than one role code and find APPR_ID
                        _PrintInfo('Role column name to be find in TRN_QRY : ' + strColumnInTrnQry.toLowerCase() + ' in data - ' + JSON.stringify(pRow), pLogInfo);
                        var strRoleCode = pRow[strColumnInTrnQry.toLowerCase()];
                        _PrintInfo('Found role code is - ' + strRoleCode, pLogInfo);
                        var arrRoleCode = strRoleCode.split(',');
                        for (var k = 0; k < arrRoleCode.length; k++) {
                            var tmparr = new reqLinq(arrAppRoles).Where(function (role) {
                                return role['role_code'] === arrRoleCode[k];
                            }).ToArray();
                            arr = arr.concat(tmparr);
                        }

                        // Find APPU_ID based on APPR_ID
                        for (var k = 0; k < arr.length; k++) {
                            var tmparr1 = new reqLinq(arrAppUserRoles).Where(function (appu_role) {
                                return appu_role['appr_id'] === arr[k]['appr_id'];
                            }).ToArray();
                            arrTmpAppuRole = arrTmpAppuRole.concat(tmparr1);
                        }

                        reqAsync.forEach(arrTmpAppuRole, function (appurole, callbackAppuRole) {
                            // find U_ID based on APPU_ID

                            reqFXDBInstance.GetTableFromFXDB(pCltCas, 'APP_USERS', ['U_ID', 'APPU_ID'], {
                                APP_ID: pAppID,
                                APPU_ID: appurole['appu_id']
                            }, pLogInfo, function callback(pError, pAppUsers) {

                                if (pError)
                                    _PrintError(pLogInfo, pError, 'ERR-COM-20042');
                                else if (pAppUsers) {
                                    // find EMAIL_ID / MOBILE_NO based on U_ID
                                    reqAsync.forEach(pAppUsers.rows, function (appu, callbackAppuser) {

                                        reqFXDBInstance.GetTableFromFXDB(pCltCas, 'USERS', ['EMAIL_ID', 'MOBILE_NO'], {
                                            U_ID: appu['u_id'],
                                            CLIENT_ID: pClientID
                                        }, pLogInfo, function callback(pError, pUsers) {

                                            if (pError)
                                                _PrintError(pLogInfo, pError, 'ERR-COM-20043');
                                            else if (pUsers) {
                                                if (pUsers.rows.length > 0)
                                                    arrEmailIDs.push(pUsers.rows[0][strColumn.toLowerCase()]);
                                            }
                                            callbackAppuser();
                                        });
                                    }, function () {
                                        callbackAppuRole();
                                    });
                                }
                            });
                        },
                            function () {
                                pRow[strColumn.toLowerCase()] = arrEmailIDs.join();
                                callbackData();
                            });
                    },
                        function () {
                            pContactInfos[0]['COLUMN_NAME'] = strColumn.toLowerCase();
                            obj = _PrepareCallbackObject('SUCCESS', null, null, null, null, null);
                            pCallback(pData, pContactInfos, obj);
                        });
                });
            });
        } else {
            obj = _PrepareCallbackObject('FAILURE', null, 'ERR-COM-20044', null, null, 'ColumnName not found in contactinfo');
            pCallback(pData, pContactInfos, obj);
        }
    } catch (error) {
        obj = _PrepareCallbackObject('FAILURE', null, 'ERR-COM-20045', 'Error on _GetRoleBasedCommInfo()', error, null);
        pCallback(pData, pContactInfos, obj);
    }
}

// To form the string concatenation with single quotes
function _FormStringCondition(pString) {
    if (pString == '')
        return '';
    var strValues = pString.split(',');
    var strTemp = '';
    for (var i = 0; i < strValues.length; i++)
        if (strTemp == '')
            strTemp = "'" + strValues[i] + "'";
        else
            strTemp = strTemp + ",'" + strValues[i] + "'";
    return strTemp;
}

// To get the attachment from Resource cassandra
function _GetAttachmentfromRS(pResCas, pTrnAttRow, pLstAttachments, pLogInfo, pCallback) {
    try {
        var objParam = {
            RELATIVE_PATH: pTrnAttRow['relative_path'],
            AT_CODE: pTrnAttRow['at_code'],
            USER_ID: pLogInfo.USER_ID,
            APP_ID: pLogInfo.APP_DESC,
            APP_DESC: pLogInfo.APP_DESC,
            USER_NAME: pLogInfo.USER_NAME,
            SYSTEM_ID: pLogInfo.SYSTEM_ID,
            SYSTEM_DESC: pLogInfo.SYSTEM_DESC,
            SESSION_ID: pLogInfo.SESSION_ID,
            HANDLER_CODE: "SEND_MESSAGE_WITH_CONTENT",
            MENU_ITEM_DESC: pLogInfo.MENU_ITEM_DESC,
            ACTION_DESC: pLogInfo.ACTION_DESC,
            CLIENT_ID: pLogInfo.USER_ID,
            PARENT_PROCESS: "SendMessage"
        };
        GetAttachment(pResCas, objParam, pLogInfo, function callbackGetAttachment(pByteStr) {
            pCallback(pByteStr, pTrnAttRow);
        });
    } catch (error) {
        _PrintError(pLogInfo, 'Error on _GetAttachmentfromRS() ', 'ERR-COM-20046', error);
    }
}

// To get attachment from resource cassandra
function GetAttachment(pResCas, pParams, pLogInfo, pCallback) {
    var obj = {};
    try {
        var pRelativePath = pParams['RELATIVE_PATH'] ? pParams['RELATIVE_PATH'] : '';
        var pATCode = pParams['AT_CODE'];
        var qry = 'SELECT byte_data,text_data FROM TRNA_DATA WHERE RELATIVE_PATH=?  ALLOW FILTERING;';
        reqFXDBInstance.GetTableFromFXDB(pResCas, 'TRNA_DATA', ['byte_data', 'text_data'], {
            RELATIVE_PATH: pRelativePath
        }, pLogInfo, function callbackGetTableFromFXDB(pError, pResult) {
            var byt = null;
            if (pError) {
                _PrintError(pLogInfo, 'Error on executing query as TRAN_DATA in resource cassandra', 'ERR-COM-20047', pError);
                pCallback(null);
            } else if (pResult) {
                if (pATCode.toUpperCase() == 'IMG') {
                    if (pResult.rows.length > 0 && pResult.rows[0]['text_data'] != null) {
                        strBase64 = pResult.rows[0]['text_data'];
                        byt = reqBase64.toByteArray(strBase64);
                    }
                } else {
                    if (pResult.rows.length > 0 && pResult.rows[0]['byte_data'] != null) {
                        byt = pResult.rows[0]['byte_data'];
                    }
                }
                obj = _PrepareCallbackObject('SUCCESS', byt, null, null, null, null);
                pCallback(byt);
            }
        });
    } catch (error) {
        _PrintError(pLogInfo, 'Error on executing query as TRAN_DATA in resource cassandra', 'ERR-COM-20048', error);
        pCallback(null);
    }
}

// To add the attachments to attachment list if attachment found
function _AddAttachments(pAttachments, pRelativePath, pByteData, pTrnID) {
    var objAtt = {
        STATIC_ATTACHMENT_NAME: pRelativePath,
        STATIC_ATTACHMENT: pByteData,
        TRN_ID: pTrnID,
        IsDeleted: false
    };
    pAttachments.push(objAtt);
}

function _PrepareCallbackObject(pStatus, pData, pErrorCode, pErrorMsg, pError, pWarning) {
    var obj = {
        Status: pStatus,
        Data: pData,
        ErrorCode: pErrorCode,
        ErrorMsg: pErrorMsg,
        Error: pError,
        Warning: pWarning
    };
    return obj;
}

function _PrintInfo(pMessage, pLogInfo) {
    reqInstanceHelper.PrintInfo('SendMessage', pMessage, pLogInfo);
}

function _PrintError(pLogInfo, pMessage, pErrorCode, pError) {
    reqInstanceHelper.PrintError('ServiceHelper', pLogInfo, pErrorCode, pMessage, pError);
}

module.exports = {
    GetRelationJSON: GetRelationJSON,
    GetKeyColumn: GetKeyColumn,
    GetTRNDetails: GetTRNDetails,
    GetAttachments: GetAttachments,
    GetEmailIDFromFXDB: GetEmailIDFromFXDB
};