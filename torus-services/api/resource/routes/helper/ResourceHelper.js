/*
@Description : Helper file for resource services 
*/

// Require dependencies
var async = require('async');
//const reqSharp = require('sharp'); // Its binaries will be different for Windows and Linux so plz re-install it for any development purpose
var reqLogWriter = require('../../../../../torus-references/log/trace/LogWriter')
var reqLogInfo = require('../../../../../torus-references/log/trace/LogInfo')
var reqTranDBInstance = require('../../../../../torus-references/instance/TranDBInstance');
var reqDBInstance = require('../../../../../torus-references/instance/DBInstance');
var reqInsHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqLINQ = require("node-linq").LINQ;
var strServiceName = 'Resource Helper'
var pClient = ''
var mTranDB = ''
var GetTrnAttachmentsres = ''
var objLogInfo = ''
var PccConfig = require('../viewer-webtier/PccConfig.json');

// Object declaration for Load attachment result

var resultobj = {}
var strWaterMarkText = ''
var strFontStyle = ''
var strFontSize = ''
var strTransparency = ''
var strATData = '';
var strNeedActionFilter = ''
var strNeedPaging = ''
var pUICGCode = ''
var pUICGCCode = ''
var strNeedAnnotation = 'N'
var strStampAnnotations = ''
var session = ''

// Function to get and prepare Attachment Details from DB
function AssignattachmentoDetail(pParams, preq, pLogInfo, psession_info, AttachmentViewerResult, callback) {
    session = psession_info
    strWaterMarkText = ''
    strFontStyle = ''
    strFontSize = ''
    strTransparency = ''
    strATData = '';
    var objLstattdetails = '';
    strNeedActionFilter = ''
    strNeedPaging = ''
    pUICGCode = ''
    pUICGCCode = ''
    strNeedAnnotation = 'N'
    strStampAnnotations = ''

    objLogInfo = pLogInfo

    try {
        _PrintInfo('Getting dep cas and trn db instance in AssignattachmentoDetail')
        reqDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function (pdepClient) {
            pClient = pdepClient
            reqTranDBInstance.GetTranDBConn(pHeaders, false, function (pSession) {
                mTranDB = pSession;
                //objLogInfo = reqLogInfo.AssignLogInfoDetail(pParams, preq);
                objLstattdetails = [];
                // objLstattdetails = new AttachmentViewerResult().AttachmentDetails;

                objLstattdetails.ATData = [];
                objLstattdetails.Actions = [];
                objLstattdetails.Annotations = '';
                if (pParams.UICG_CODE != '' && pParams.UICG_CODE != undefined) {
                    pUICGCode = pParams.UICG_CODE
                }
                if (pParams.pUICGCCode != undefined && pParams.pUICGCCode != '') {
                    pUICGCCode = pParams.pUICGCCode
                }
                if (pParams.NEED_ATMT_ACTION_FILTER != undefined && pParams.NEED_ATMT_ACTION_FILTER != '' && pParams.NEED_ATMT_ACTION_FILTER == "Y") {
                    strNeedActionFilter = pParams.NEED_ATMT_ACTION_FILTER
                }
                if (pParams.FETCH_ATMT_PAGE_BY_PAGE != undefined && pParams.FETCH_ATMT_PAGE_BY_PAGE != '' && pParams.FETCH_ATMT_PAGE_BY_PAGE == "Y") {
                    strNeedPaging = pParams.FETCH_ATMT_PAGE_BY_PAGE
                }
                if (pParams.NEED_ANNOTATION_IMAGE != undefined && pParams.NEED_ANNOTATION_IMAGE != '' && pParams.NEED_ANNOTATION_IMAGE == "Y") {
                    strNeedAnnotation = pParams.NEED_ANNOTATION_IMAGE
                }
                if (pParams.WFTPA_ANNOTATIONS != undefined && pParams.WFTPA_ANNOTATIONS != '') {
                    strStampAnnotations = JSON.parse(pParams.WFTPA_ANNOTATIONS)
                }

                if (pParams.TRNA_ID != 0) {
                    objTRNA = 'SELECT * FROM TRN_ATTACHMENTS  WHERE DTT_CODE=' + '\'' + pParams.DTT_CODE + '\'' + ' and ' + 'TRN_ID=' + pParams.TRN_ID + ' and ' + 'TRNA_ID =' + pParams.TRNA_ID + ' and ' + 'IS_CURRENT =' + '\'' + 'Y' + '\''
                    _PrintInfo('TRNA_ID is valid. Prepared TRNA query is - ' + objTRNA)

                } else {
                    objTRNA = 'SELECT * FROM TRN_ATTACHMENTS  WHERE DTT_CODE=' + '\'' + pParams.DTT_CODE + '\'' + ' and ' + 'TRN_ID=' + pParams.TRN_ID + ' and ' + 'IS_CURRENT =' + '\'' + 'Y' + '\''
                    _PrintInfo('TRNA_ID is 0. Prepared TRNA query is - ' + objTRNA)
                }

                reqTranDBInstance.ExecuteSQLQuery(mTranDB, objTRNA, objLogInfo, function rescallback(Res, pErr) {
                    if (pErr) {
                        resultobj.error = 'Y'
                        resultobj.data = pErr
                        resultobj.error_code = 'ERR-RES-70018'
                        resultobj.error_message = 'Error while' + objTRNA + 'Execution'
                        callback(resultobj)
                    } else {
                        if (Res != '' && Res.rows.length == 1) {
                            _PrintInfo('TRNA query result is - ' + Res.rows.length)
                            __PrepareAttachmentDetails(Res.rows[0], pParams, strNeedAnnotation, strStampAnnotations, strNeedPaging, strNeedActionFilter, AttachmentViewerResult, function (objAttDetail) {
                                if (objAttDetail) {
                                    objLstattdetails[0] = objAttDetail
                                }
                                return callback(objLstattdetails)
                            })

                        } else if (Res.rows.length > 0) {
                            async.forEachOf(Res.rows, function (value, key, ascallback) {
                                __PrepareAttachmentDetails(Res.rows[key], pParams, strNeedAnnotation, strStampAnnotations, strNeedPaging, strNeedActionFilter, AttachmentViewerResult, function (objAttDetail) {
                                    objLstattdetails.push(objAttDetail)
                                    ascallback();
                                })
                            }, function (err) {
                                if (err) console.error(err.message);
                                // objLstattdetails.shift()
                                console.log('objLstattdetails count ' + objLstattdetails.length)
                                return callback(objLstattdetails)
                            });
                        } else {
                            callback('');
                        }
                    }
                })
            })
        })
    } catch (error) {
        resultobj.error = 'Y'
        resultobj.data = error
        resultobj.error_code = 'ERR-RES-70011'
        resultobj.error_message = 'Error while getting AssignattachmentoDetail'
        _PrintInfo('Error while getting AssignattachmentoDetail')
        callback(resultobj)
    }
}
//Function to Prepare Attachment Details
function __PrepareAttachmentDetails(objTRNA, pParams, strNeedAnnotation, strStampAnnotations, strNeedPaging, strNeedActionFilter, pAttachmentViewerResult, callback) {
    _PrintInfo('Preparing Attachment Details..')
    //Get Relative Path
    var RelPath = objTRNA.relative_path
    //Get WaterMark Templates
    if (objTRNA.watermark_code != '' && objTRNA.watermark_code != undefined) {
        _PrintInfo('Getting watermark details for code : ' + objTRNA.watermark_code)
        try {
            var pCond = {
                'APP_ID': session.APP_ID,
                'WMT_CODE': objTRNA.watermark_code
            };
            reqDBInstance.GetTableFromFXDB(pClient, 'WATERMARK_INFO', [], pCond, objLogInfo, function (error, result) {
                if (error) {
                    resultobj.error = 'Y'
                    resultobj.data = error
                    resultobj.error_code = 'ERR-RES-70012'
                    resultobj.error_message = 'Error while getting WATERMARK_INFO'
                    _PrintInfo('Error while getting WATERMARK_INFO')
                    callback(resultobj)
                } else {
                    var wmtemplates = result
                    for (var rwWM in wmtemplates) {
                        if (rwWM.template_json != '') {
                            var jsn = Json.parse(rwWM.template_json)
                            strWaterMarkText = jsn.WATERMARK_TEXT.toString()
                            strWaterMarkText = __FormatValues(strWaterMarkText, session.U_ID, session.USER_NAME)
                            strFontStyle = jsn.FONT.toString()
                            strFontSize = jsn.FONT_SIZE.toString()
                            strTransparency = jsn.TRANSPARENCY.toString()
                            if (CInt(strTransparency) > 100) {
                                strTransparency = "20"
                            }
                        }
                    }
                }
            })

        } catch (error) {
            resultobj.error = 'Y'
            resultobj.data = error
            resultobj.error_code = 'ERR-RES-70013'
            resultobj.error_message = 'Error while getting watermark_info - __PrepareAttachmentDetails'
            _PrintInfo('Error while getting watermark_info - __PrepareAttachmentDetails')
            callback(resultobj)
        }
    }
    // Get Attachment Thumb nail icon data from attachment types
    strATData = "data:image/x-icon;base64,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"

    // Get Transaction Allocations
    var lstActions = ''
    if (strNeedActionFilter == "Y") {
        _PrintInfo("Need Action Filter is 'Y'")
        try {
            var uname = pParams.USER_NAME;
            var cond = 'ITEM_ID=' + objTRNA.trna_id + ' AND ' + 'ITEM_TYPE=' + '\'' + 'ATMT' + '\'' + '  AND ' + 'ALLOCATED_APPU_ID=' + '\'' + session.APPU_ID + '\'' + ' AND ' + 'ALLOCATED_APPUSER_NAME = ' + '\'' + uname + '\''
            var objTrnAlloc = 'SELECT * FROM TRANSACTION_ALLOCATIONS WHERE ' + cond
            _PrintInfo('Getting Transaction Allocations - ' + objTrnAlloc)
            reqTranDBInstance.ExecuteSQLQuery(mTranDB, objTrnAlloc, objLogInfo, function rcallback(pRes, pErr) {
                try {
                    if (pErr) {
                        resultobj.error = 'Y'
                        resultobj.data = pErr
                        resultobj.error_code = 'ERR-RES-70019'
                        resultobj.error_message = 'Error while TRANSACTION_ALLOCATIONS - execution'
                        _PrintInfo('Error while TRANSACTION_ALLOCATIONS - execution')
                        callback(resultobj)
                    } else {
                        if (pRes != '' && pRes.rows.length == 0) {
                            var cond = 'ITEM_ID=' + objTRNA.trna_id + ' AND ' + 'ITEM_TYPE=' + '\'' + 'ATMT' + '\'' + '  AND ' + 'ALLOCATED_APPR_ID=' + '\'' + pParams.APPUR_ID + '\''
                            var objTrnAlloc = 'SELECT * FROM TRANSACTION_ALLOCATIONS WHERE ' + cond
                            _PrintInfo('Getting Transaction Allocations - ' + objTrnAlloc)
                            reqTranDBInstance.ExecuteSQLQuery(mTranDB, objTrnAlloc, objLogInfo, function rcallback(pRes, pErr) {
                                if (pErr) {
                                    resultobj.error = 'Y'
                                    resultobj.data = pErr
                                    resultobj.error_code = 'ERR-RES-70023'
                                    resultobj.error_message = 'Error while TRANSACTION_ALLOCATIONS - execution'
                                    _PrintInfo('Error while TRANSACTION_ALLOCATIONS - execution')
                                    callback(resultobj)
                                } else {
                                    if (pRes != '' && pRes.rows.length > 0) {
                                        var intTRNALLOCId = pRes.rows[0].ta_id
                                        var pcond = 'TA_ID=' + '\'' + intTRNALLOCId + '\''
                                        var objTrnAllocActions = 'SELECT * FROM TRANSACTION_ALLOCATION_ACTIONS WHERE ' + pcond
                                        _PrintInfo('Getting Transaction Allocation Actions - ' + objTrnAllocActions)
                                        reqTranDBInstance.ExecuteSQLQuery(mTranDB, objTrnAllocActions, objLogInfo, function acallback(Res, pErr) {
                                            if (pErr) {
                                                resultobj.error = 'Y'
                                                resultobj.data = pErr
                                                resultobj.error_code = 'ERR-RES-70024'
                                                resultobj.error_message = 'Error while TRANSACTION_ALLOCATION_ACTIONS table execution'
                                                _PrintInfo('Error while TRANSACTION_ALLOCATION_ACTIONS table execution')
                                                callback(resultobj)
                                            } else {
                                                if (Res != '' && Res.rows.length > 0) {
                                                    // lstActions = Res.rows[0].action_code
                                                    lstActions = new reqLINQ(Res.rows)
                                                        .Select(function (u) {
                                                            return u.action_code;
                                                        }).ToArray();
                                                    GetAnnotaionDetails(strStampAnnotations, objTRNA, pParams, lstActions, RelPath, pAttachmentViewerResult, function (finalres) {
                                                        return callback(finalres)

                                                    })
                                                } else {
                                                    GetAnnotaionDetails(strStampAnnotations, objTRNA, pParams, lstActions, RelPath, pAttachmentViewerResult, function (finalres) {
                                                        return callback(finalres)

                                                    })
                                                }
                                            }
                                        })
                                    } else {
                                        GetAnnotaionDetails(strStampAnnotations, objTRNA, pParams, lstActions, RelPath, pAttachmentViewerResult, function (finalres) {
                                            return callback(finalres)

                                        })

                                    }
                                }
                            })

                        } else {
                            var intTRNALLOCId = pRes.rows[0].ta_id
                            var pcond = 'TA_ID=' + '\'' + intTRNALLOCId + '\''
                            var objTrnAllocActions = 'SELECT * FROM TRANSACTION_ALLOCATION_ACTIONS WHERE ' + pcond
                            _PrintInfo('Getting Transaction Allocation Actions - ' + objTrnAllocActions)
                            reqTranDBInstance.ExecuteSQLQuery(mTranDB, objTrnAllocActions, objLogInfo, function acallback(Res, pErr) {
                                if (pErr) {
                                    resultobj.error = 'Y'
                                    resultobj.data = pErr
                                    resultobj.error_code = 'ERR-RES-70022'
                                    resultobj.error_message = 'Error while TRANSACTION_ALLOCATION_ACTIONS table execution'
                                    _PrintInfo('Error while TRANSACTION_ALLOCATION_ACTIONS table execution')
                                    callback(resultobj)
                                } else {
                                    if (Res != '' && Res.rows.length > 0) {
                                        // lstActions = Res.rows[0].action_code
                                        lstActions = new reqLINQ(Res.rows)
                                            .Select(function (u) {
                                                return u.action_code;
                                            }).ToArray();
                                        GetAnnotaionDetails(strStampAnnotations, objTRNA, pParams, lstActions, RelPath, pAttachmentViewerResult, function (finalres) {
                                            return callback(finalres)

                                        })
                                    } else {
                                        GetAnnotaionDetails(strStampAnnotations, objTRNA, pParams, lstActions, RelPath, pAttachmentViewerResult, function (finalres) {
                                            return callback(finalres)

                                        })
                                    }
                                }
                            })

                        }
                    }
                } catch (error) {
                    resultobj.error = 'Y'
                    resultobj.data = error
                    resultobj.error_code = 'ERR-RES-70014'
                    resultobj.error_message = 'Error while getting TrnAllocation Actions - __PrepareAttachmentDetail'
                    _PrintInfo('Error while getting TrnAllocation Actions - __PrepareAttachmentDetail')
                    callback(resultobj)
                }
            })
        } catch (error) {
            resultobj.error = 'Y'
            resultobj.data = error
            resultobj.error_code = 'ERR-RES-70015'
            resultobj.error_message = 'Error While Getting Action Filter - __PrepareAttachmentDetail'
            _PrintInfo('Error While Getting Action Filter - __PrepareAttachmentDetail')
            callback(resultobj)
        }
    } else {
        _PrintInfo("Need Action Filter is 'N'. Getting Annotation Details")
        GetAnnotaionDetails(strStampAnnotations, objTRNA, pParams, lstActions, RelPath, pAttachmentViewerResult, function (finalres) {
            return callback(finalres)
        })
    }

    // Get AnnotationDetails

}

function GetAnnotaionDetails(strStampAnnotations, objTRNA, pParams, lstActions, RelPath, AttachmentViewerResult, pcallback) {
    var lstAnn = new AttachmentViewerResult().Annotations;
    lstAnnArr = [];
    try {

        var lstTrnAnnt = 'SELECT * FROM TRN_ANNOTATIONS WHERE TRN_ID=' + objTRNA.trna_id
        _PrintInfo('Annotations query - ' + lstTrnAnnt)
        reqTranDBInstance.ExecuteSQLQuery(mTranDB, lstTrnAnnt, objLogInfo, function attcallback(Res, pErr) {
            if (pErr) {
                resultobj.error = 'Y'
                resultobj.data = pErr
                resultobj.error_code = 'ERR-RES-70020'
                resultobj.error_message = 'Error While TRN_ANNOTATIONS Selection'
                _PrintInfo('Error While Getting Action Filter - __PrepareAttachmentDetail')
                callback(resultobj)
            } else {
                if (Res.rows.length > 0) {
                    _PrintInfo('Annotation result is ' + Res.rows.length)
                    Res.rows.forEach(function (drAnn) {
                        lstAnn[0].AnnotationId = drAnn.annotation_id
                        lstAnn[0].AnnotationType = drAnn.annotation_type
                        lstAnn[0].AnnotationText = drAnn.annotation_text
                        lstAnn[0].AnnotationData = drAnn.annotation_data

                    })

                } else {
                    _PrintInfo('Annotation result is 0')
                    lstAnn[0].AnnotationId = ""
                    lstAnn[0].AnnotationType = ""
                    lstAnn[0].AnnotationText = ""
                    lstAnn[0].AnnotationData = ""

                }
                if (strStampAnnotations != '') {
                    var jsnAnn = strStampAnnotations
                    if (jsnAnn != '') {
                        strStampAnnotations = ''
                        jsnAnn.forEach(function (objJsn) {
                            if (objJsn.ANNOTATION_TYPE == "STAMP") {
                                var strStmp = ''
                                strStmp = StringFormat('<div>{0}</div>', objJsn.ANNOTATION_TEXT)
                                strStampAnnotations = strStampAnnotations + strStmp
                            }
                        })
                    }
                }
                var strChkOut = ''
                if (objTRNA.checked_out_date != null && objTRNA.checked_out_date != '') {
                    strChkOut = objTRNA.checked_out_date
                }
                var strVersionNo = "1"
                if (objTRNA.versioning != null && objTRNA.versioning != '') {
                    strVersionNo = objTRNA.versioning
                }
                var attdetails = []
                attdetails.push({})
                attdetails[0].ATData = [];
                attdetails[0].Actions = [];
                attdetails[0].Annotations = '';
                attdetails[0].AttId = objTRNA.trna_id
                attdetails[0].ATCode = objTRNA.at_code
                attdetails[0].FilePath = RelPath
                attdetails[0].ViewerType = pParams.VIEWER_TYPE
                attdetails[0].ATData = strATData
                attdetails[0].WaterMarkText = strWaterMarkText,
                    attdetails[0].font = strFontStyle,
                    attdetails[0].fontsize = strFontSize,
                    attdetails[0].Transparency = strTransparency,
                    attdetails[0].Actions = lstActions,
                    attdetails[0].LoadPageByPage = strNeedPaging,
                    attdetails[0].ImageColor = '',
                    attdetails[0].ImageFormat = objTRNA.dttac_desc,
                    attdetails[0].Dttad_id = objTRNA.dttad_id,
                    attdetails[0].Dttadif_id = 0,
                    attdetails[0].Annotations = lstAnn,
                    attdetails[0].NeedAnnotation = strNeedAnnotation,
                    attdetails[0].CBOStampAnnotations = strStampAnnotations,
                    attdetails[0].RS_STORAGE_TYPE = pParams.RS_STORAGE_TYPE
                attdetails[0].RS_DB_INFO = pParams.RS_DB_INFO
                attdetails[0].Userid = session.U_ID
                attdetails[0].GroupId = objTRNA.group_id
                attdetails[0].VersionNo = 'V' + strVersionNo
                attdetails[0].CheckOutBy = objTRNA.checked_out_by
                attdetails[0].CheckOutDate = strChkOut
                attdetails[0].IsCurrent = objTRNA.is_current
                attdetails[0].CheckOutByName = objTRNA.checked_out_by_name
                attdetails[0].OriginalFileName = objTRNA.original_file_name
                _PrintInfo('Attachment Details prepared successfully..')
                return pcallback(attdetails[0]);
            }
        })

    } catch (error) {
        resultobj.error = 'Y'
        resultobj.data = error
        resultobj.error_code = 'ERR-RES-70016'
        resultobj.error_message = 'Error while getting annotations - __PrepareAttachmentDetail'
        _PrintInfo('Error while getting annotations - __PrepareAttachmentDetail')
        callback(resultobj)
    }
}

function __GetTrnAttachments(pTRNAId, pTRNId, pUICGCode, pUICGCCode, pDT_Code, pDTT_Code, pAppid, plogInfo, callback) {
    var objTRNA = ''

    try {
        if (pTRNAId != 0) {
            objTRNA = 'SELECT * FROM TRN_ATTACHMENTS  WHERE DTT_CODE=' + '\'' + pDTT_Code + '\'' + ' and ' + 'TRN_ID=' + pTRNId + ' and ' + 'TRNA_ID =' + pTRNAId + ' and ' + 'IS_CURRENT =' + '\'' + 'Y' + '\''

        } else {
            objTRNA = 'SELECT * FROM TRN_ATTACHMENTS  WHERE DTT_CODE=' + '\'' + pDTT_Code + '\'' + ' and ' + 'TRN_ID=' + pTRNId + ' and ' + 'IS_CURRENT =' + '\'' + 'Y' + '\''
        }
        reqTranDBInstance.ExecuteSQLQuery(mTranDB, objTRNA, objLogInfo, function callback(Res, pErr) {
            if (pErr) {
                resultobj.error = 'Y'
                resultobj.data = error
                resultobj.error_code = 'ERR-RES-70024'
                resultobj.error_message = 'Error while TRN_ATTACHMENTS execution'
                _PrintInfo('Error while TRN_ATTACHMENTS execution')
                callback(resultobj)
            } else {

                GetTrnAttachmentsres = Res.rows
                return callback(GetTrnAttachmentsres);
            }
        })
    } catch (error) {
        resultobj.error = 'Y'
        resultobj.data = error
        resultobj.error_code = 'ERR-RES-70017'
        resultobj.error_message = 'Error while getting TrnAttachments - __PrepareAttachmentDetail'
        _PrintInfo('Error while getting TrnAttachments - __PrepareAttachmentDetail')
        callback(resultobj)

    }

}

function __FormatValues(Pattern, pUserid, pUsername) {
    var DefValue = Pattern
    if (DefValue != "") {
        DefValue = DefValue.Replace("$DATE1$", DateTime.Now.toString("ddMMyyyy"))
        DefValue = DefValue.Replace("$DATE2$", DateTime.Now.toString("MMddyyyy"))
        DefValue = DefValue.Replace("$DATE3$", DateTime.Now.toString("ddMMyy"))
        DefValue = DefValue.Replace("$DATE4$", DateTime.Now.toString("MMddyy"))
        DefValue = DefValue.Replace("$TIME1$", DateTime.Now.toString("hhmm"))
        DefValue = DefValue.Replace("$TIME2$", DateTime.Now.toString("hhmmss"))
        DefValue = DefValue.Replace("$UID$", pUserid.toString())
        DefValue = DefValue.Replace("$USERNAME$", pUsername)
        DefValue = DefValue.Replace("$TICKS$", DateTime.Now.Ticks.toString)
        DefValue = DefValue.Replace("$TICKSTODAY$", (DateTime.Today.Ticks - DateTime.Now.AddDays(-1).Ticks).toString)
    }
    return DefValue
}
// Custom functions

var StringFormat = function () {
    if (!arguments.length)
        return "";
    var str = arguments[0] || "";
    str = str.toString();
    var args = typeof arguments[0],
        args = (("string" == args) ? arguments : arguments[0]);
    [].splice.call(args, 0, 1);
    for (var arg in args)
        str = str.replace(RegExp("\\{" + arg + "\\}", "gi"), args[arg]);
    str = str.replace(RegExp("\\{\\{", "gi"), "{");
    str = str.replace(RegExp("\\}\\}", "gi"), "}");
    return str;
};

function StringBuilder() {
    var strings = [];
    //  this.sbstring = [];
    this.append = function (string) {
        string = verify(string);
        if (string.length > 0) strings[strings.length] = string;
    };

    this.appendLine = function (string) {
        string = verify(string);
        if (this.isEmpty()) {
            if (string.length > 0) strings[strings.length] = string;
            else return;
        } else strings[strings.length] = string.length > 0 ? "\r\n" + string : "\r\n";
    };

    this.clear = function () {
        strings = [];
        //sbstring = [];
    };

    this.length = function () {

        return strings.length;
    }

    this.isEmpty = function () {
        return strings.length == 0;
    };

    this.toString = function () {
        return strings.join("");
    };

    var verify = function (string) {
        if (!defined(string)) return "";
        if (getType(string) != getType(new String())) return String(string);
        return string;
    };

    var defined = function (el) {

        return el != null && typeof (el) != "undefined";
    };

    var getType = function (instance) {
        if (!defined(instance.constructor)) throw Error("Unexpected object type");
        var type = String(instance.constructor).match(/function\s+(\w+)/);

        return defined(type) ? type[1] : "undefined";
    };

}

// To Check the Image File Format[TIF] and Do the Process
function CheckFileExtIsTIF(pReqObj, CheckFileExtIsTIFCB) {
    try {
        var fileExt = pReqObj.strFileExt;
        var tiffBuffer = pReqObj.bytData;
        var textData = pReqObj.textData;
        console.log('File Extension - ' + fileExt);
        if (textData && textData.startsWith('SUkqA')) {
            console.log('Converting TIF Buffer into JPEG Format by using Sharp Npm...');
            // reqSharp(tiffBuffer)
            //     .png()
            //     .toBuffer()
            //     .then(function (buffer) {
            //         console.log('Successfully Converted...', buffer);
            //         CheckFileExtIsTIFCB(null, buffer);
            //     })
            //     .catch(function (err) {
            //         console.log(err, "======= Image Format Conversion Failed ==============");
            //         CheckFileExtIsTIFCB(err, null);
            //     });
            CheckFileExtIsTIFCB(null, true);
        } else {
            console.log('This is Not TIFF Format Image File...So Skipping Image Conversion....');
            CheckFileExtIsTIFCB(null, false);
        }
    } catch (error) {
        console.log('Catch Error in CheckFileExtIsTIF() - ' + error);
        CheckFileExtIsTIFCB(error, false);
    }
}


function _PrintInfo(pMessage) {
    reqInsHelper.PrintInfo(strServiceName, pMessage, objLogInfo)
}

function _PrintErr(pError, pErrorCode, pMessage) {
    reqInsHelper.PrintError(strServiceName, pError, pErrorCode, objLogInfo, pMessage)
}
module.exports = {
    AssignattachmentoDetail: AssignattachmentoDetail,
    StringBuilder: new StringBuilder,
    StringFormat: StringFormat,
    PccConfig: PccConfig,
    CheckFileExtIsTIF: CheckFileExtIsTIF
}