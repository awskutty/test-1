var reqExpress = require('express');
var router = reqExpress.Router();
//var reqCassandraInstance = require('../../../../torus-references/instance/CassandraInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var reqSaveList = require('./helper/NlicSaveList');
var reqsavesharepointdata = require('./helper/SaveSharepointData');
var StringBuilder = require("string-builder"); 
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');



var mTranDB = '';
router.post('/UploadNlicFiles', function(pReq, pResp, next) {
    var StrRsParams = pReq.body.RELATIVE_PATH;
    var DT_CODE = pReq.body.DT_CODE;
    var Attach_Category = pReq.body.ATTACH_CATEGORY;
    var KEYVALUE = pReq.body.KEYVALUE;
    var spu_id = pReq.body.SPU_ID;
    var dynamicdata = pReq.body.DYNAMICDATA;
    var savetype = pReq.body.SAVETYPE;
    var BYTEDATA = pReq.body.FILECONTENT;
    var scantype = pReq.body.scantype;
    var strclaim_no = '';
    var strclaimname = '';
    var strtrcdid = '';
    var strtrnaid = '';
    var strrelativepath = '';
    var jparse = '';

    var dynamicresult = '';
    if (dynamicdata != '') {
        dynamicresult = JSON.parse(dynamicdata);
    }

    if (savetype == undefined || savetype == "") {
        savetype = "saveall";
    }
    var arrAtmts = [];


    var SaveAttachmentDetail = JSON.parse(StrRsParams);
    var atmt_dtt_code = SaveAttachmentDetail.Items[0].ATMT_DTT_CODE;
    var relative_path = SaveAttachmentDetail.Items[0].RELATIVE_PATH;

    var FOLDER_TRN_ID = '';
    var FOLDER_DTT_CODE = '';
    var dt_code = '';
    var objLogInfo = reqLogInfo.AssignLogInfoDetail(pReq.body, pReq);
    reqTranDBInstance.GetTranDBConn(pReq.headers, false, function(pSession) {
        if (savetype == 'UPLOADONLY') {
            var img = {};
            img.FILE_NAME = relative_path;
            img.RELATIVE_PATH = relative_path;
            img.BYTE_DATA = BYTEDATA;
            img.AT_CODE = SaveAttachmentDetail.Items[0].AT_CODE;
            arrAtmts.push(img)

            strclaimname = dynamicresult.LOADDYANMICDATA[0].CONTROL_NAME;
            strclaimname = strclaimname.replace("txt~", "")
            if (strclaimname == "NCP_CLAIM_FORM_NO") {
                strclaim_no = dynamicresult.LOADDYANMICDATA[0].CONTROL_VALUE;
            }

            var nclproviderid = '';
            var str_provider_id = dynamicresult.LOADDYANMICDATA[2].CONTROL_NAME;
            str_provider_id = str_provider_id.replace("txt~", "")
            if (str_provider_id == "PROVIDER_ID") {
                nclproviderid = dynamicresult.LOADDYANMICDATA[2].CONTROL_VALUE;
            }

            var nclyear = '';
            var str_year = dynamicresult.LOADDYANMICDATA[4].CONTROL_NAME;
            str_year = str_year.replace("txt~", "")
            if (str_year == "NCP_YEAR") {
                nclyear = dynamicresult.LOADDYANMICDATA[4].CONTROL_VALUE;
            }

            var nclmonth = '';
            var str_month = dynamicresult.LOADDYANMICDATA[5].CONTROL_NAME;
            str_month = str_month.replace("txt~", "")
            if (str_month == "NCP_MONTH") {
                nclmonth = dynamicresult.LOADDYANMICDATA[5].CONTROL_VALUE;
            }

            mTranDB = pSession;
            var relqry = "select tncd_id from  TRN_NLIC_CLAIM_DETAILS where  ncp_claim_form_no='" + strclaim_no + "' and provider_id ='" + nclproviderid + "' and ncp_month='" + nclmonth + "' and ncp_year ='" + nclyear + "'";
            reqTranDBInstance.ExecuteSQLQuery(mTranDB, relqry, objLogInfo, function(Rel, pErr) {

                if (Rel.rows.length == 0) {
                    console.log('trnd_id not found", "ERR-FX-133402');
                    pResp.send('FAILURE')
                } else {
                    strtrcdid = Rel.rows[0].tncd_id;
                }

                //  var relativepathqry = "select TRNA_ID,relative_path from trn_attachments where attachment_title='" + Attach_Category + "' and relative_path='" + relative_path + "'";



                var attachqry = "select trna_id,relative_path from trn_attachments where dtt_code='DTT_1304_1475833341484' and trn_id= '" + strtrcdid + "'";
                reqTranDBInstance.ExecuteSQLQuery(mTranDB, attachqry, objLogInfo, function(ATT, pErr) {

                    if (ATT.rows.length == 0) {
                        console.log('trna_id not found", "ERR-FX-133402');
                        pResp.send('FAILURE');
                    } else {
                        strtrnaid = ATT.rows[0].trna_id;
                        strrelativepath = ATT.rows[0].relative_path;
                    }


                    if (strrelativepath == '') {

                        //  var relativepathqry = "select TRNA_ID,relative_path from trn_attachments where attachment_title='" + Attach_Category + "' and relative_path='" + relative_path + "'";
                        var updqry = "update trn_attachments set relative_path ='" + relative_path + "'  , original_file_name ='" + relative_path + "' where  trna_id ='" + strtrnaid + "'";

                        reqsavesharepointdata.savesharepointdata(arrAtmts, pReq, function CallbackAddcontent(pResult) {

                            reqTranDBInstance.ExecuteSQLQuery(mTranDB, updqry, objLogInfo, function(pResult, pErr) {
                                pResp.send('SUCCESS');
                            });

                        });
                    } else {
                        dataparams(strtrcdid, '');

                        var parsedataresult = jparse;
                        var img = {};
                        img.FILE_NAME = relative_path;
                        img.RELATIVE_PATH = relative_path;
                        img.BYTE_DATA = BYTEDATA;
                        img.AT_CODE = SaveAttachmentDetail.Items[0].AT_CODE;
                        arrAtmts.push(img)

                        reqsavesharepointdata.savesharepointdata(arrAtmts, pReq, function CallbackAddcontent(pResult) {
                            try {
                                if (pResult == 'SUCCESS') {
                                    reqSaveList.SaveList(jparse, pReq, dynamicresult, function callback(pResult) {
                                        console.log("Save content result " + pResult);
                                        pResp.send('SUCCESS');
                                    })
                                }
                            } catch (error) {
                                errorHandler("ERR-FX-18801", "Error in SaveAddContentFiles" + error)
                            }
                        });
                        pResp.send('SUCCESS');

                    }


                });

            });


        }
        mTranDB = pSession;



        if (savetype == "saveall") {

            var img = {};
            img.FILE_NAME = relative_path;
            img.RELATIVE_PATH = relative_path;
            img.BYTE_DATA = BYTEDATA;
            img.AT_CODE = SaveAttachmentDetail.Items[0].AT_CODE;
            arrAtmts.push(img)

            strclaimname = dynamicresult.LOADDYANMICDATA[0].CONTROL_NAME;
            strclaimname = strclaimname.replace("txt~", "")
            if (strclaimname == "NCP_CLAIM_FORM_NO") {
                strclaim_no = dynamicresult.LOADDYANMICDATA[0].CONTROL_VALUE;
            }

            var nclproviderid = '';
            var str_provider_id = dynamicresult.LOADDYANMICDATA[2].CONTROL_NAME;
            str_provider_id = str_provider_id.replace("txt~", "")
            if (str_provider_id == "PROVIDER_ID") {
                nclproviderid = dynamicresult.LOADDYANMICDATA[2].CONTROL_VALUE;
            }

            var nclyear = '';
            var str_year = dynamicresult.LOADDYANMICDATA[4].CONTROL_NAME;
            str_year = str_year.replace("txt~", "")
            if (str_year == "NCP_YEAR") {
                nclyear = dynamicresult.LOADDYANMICDATA[4].CONTROL_VALUE;
            }

            var nclmonth = '';
            var str_month = dynamicresult.LOADDYANMICDATA[5].CONTROL_NAME;
            str_month = str_month.replace("txt~", "")
            if (str_month == "NCP_MONTH") {
                nclmonth = dynamicresult.LOADDYANMICDATA[5].CONTROL_VALUE;
            }


            mTranDB = pSession;
            var relqry = "select tncd_id from  TRN_NLIC_CLAIM_DETAILS where  ncp_claim_form_no='" + strclaim_no + "' and provider_id ='" + nclproviderid + "' and ncp_month='" + nclmonth + "' and ncp_year ='" + nclyear + "'";
            reqTranDBInstance.ExecuteSQLQuery(mTranDB, relqry, objLogInfo, function(Rel, pErr) {
                if (Rel.rows.length == 0) {
                    reqsavesharepointdata.savesharepointdata(arrAtmts, pReq, function CallbackAddcontent(pResult) {
                        try {
                            if (pResult == 'SUCCESS') {
                                dataparams('', '');
                                reqSaveList.SaveList(jparse, pReq, dynamicresult, function callback(pResult) {
                                    console.log("Save content result " + pResult);
                                    pResp.send('SUCCESS');
                                })
                            }
                        } catch (error) {
                            errorHandler("ERR-FX-18801", "Error in SaveAddContentFiles" + error)
                        }
                    });
                } else {
                    strtrcdid = Rel.rows[0].tncd_id;
                    dataparams(strtrcdid, '');
                    reqsavesharepointdata.savesharepointdata(arrAtmts, pReq, function CallbackAddcontent(pResult) {
                        try {
                            if (pResult == 'SUCCESS') {
                                reqSaveList.SaveList(jparse, pReq, dynamicresult, function callback(pResult) {
                                    console.log("Save content result " + pResult);
                                    pResp.send('SUCCESS');
                                })
                            }
                        } catch (error) {
                            errorHandler("ERR-FX-18801", "Error in SaveAddContentFiles" + error)
                        }
                    });
                }
            });


        } else if (savetype == 'SAVELIST') {
            dataparams('', atmt_dtt_code);
            reqSaveList.SaveList(jparse, pReq, dynamicresult, function callback(pResult) {
                console.log("Save content result " + pResult);
                pResp.send('SUCCESS');
            })
        }



        function dataparams(trn_id, patmt_dtt_code) {

            var arrattachmenttypes = [];
            var FileList = [];
            //AttachmentDetails = {};
            var objloginfo = {};
            var LOGINFO = {};
            LOGINFO.APP_ID = '12';
            LOGINFO.APP_DESC = 'SHAREPOINT';
            LOGINFO.USER_ID = '10';
            LOGINFO.USER_NAME = 'IFRAS_MAKER';
            LOGINFO.SYSTEM_ID = '18';
            LOGINFO.SYSTEM_DESC = 'Training Department';
            LOGINFO.HANDLER_CODE = 'UPLOAD_FILES';
            LOGINFO.SESSION_ID = '';
            LOGINFO.MENU_ITEM_DESC = 'SAVE_SHAREPOINTDATA';
            LOGINFO.CLIENT_ID = '';
            LOGINFO.ACTION_DESC = 'SHAREPOINT';
            objloginfo.LOGINFO = LOGINFO;



            var attachmentdetails = {};
            // attachmentdetails.filepath = KEYVALUE;
            attachmentdetails.APPSTS_ID = '18';
            attachmentdetails.APP_ID = '12';
            attachmentdetails.DT_CODE = DT_CODE;
            attachmentdetails.DTT_CODE = atmt_dtt_code;
            attachmentdetails.ATMT_DT_CODE = '';
            attachmentdetails.FILE_COUNT = '1';
            attachmentdetails.FOLDER_DTT_CODE = FOLDER_DTT_CODE;
            attachmentdetails.FOLDER_TRN_ID = FOLDER_TRN_ID;
            attachmentdetails.Grouping_mode = 'SINGLE_SET';
            attachmentdetails.SPU_ID = spu_id;

            attachmentdetails.LOGINFO = objloginfo.LOGINFO;

            attachmentdetails.NEED_ENCRYPTION = '';
            attachmentdetails.RS_DB_INFO = '';
            attachmentdetails.RS_STORAGE_TYPE = '';
            attachmentdetails.RSPARAMS = '';
            attachmentdetails.S_ID = '18';
            attachmentdetails.WFTPA_ID = '0';

            attachmentdetails.LOGIN_NAME = 'IFRAS_MAKER';
            attachmentdetails.TRN_ID = '';
            attachmentdetails.PARENTKEYCOLUMN = '';
            attachmentdetails.PARENTKEYVALUE = '0';
            attachmentdetails.SOURCE = 'SCAN';
            attachmentdetails.SOURCE_DETAILS = 'SHAREPOINT';
            attachmentdetails.Multiset_relativepath = '';
            attachmentdetails.PDF_STATUS = '';
            attachmentdetails.PDFATTACH_CATEGORY = '';

            var objRsParams = {}
            var arrItems = [];
            var Items = {};
            Items.RS_CODE = '';
            Items.RELATIVE_PATH = relative_path;
            Items.FILE_NAME = relative_path;
            Items.RS_PATH = '';
            Items.ATMT_DTT_CODE = patmt_dtt_code;
            Items.DTTA_ID = '1';
            Items.DTTAD_ID = '1';
            Items.DTTADIF_ID = '0';
            Items.TRN_ID = trn_id;
            Items.FILE_SIZE = '';
            Items.COMMENT = '';
            Items.AT_CODE = SaveAttachmentDetail.Items[0].AT_CODE;
            Items.DTTAC_DESC = 'General';
            Items.PARENT_TRN_ID = '0';
            arrItems.push(Items)

            objRsParams.Items = arrItems

            attachmentdetails.RSPARAMS = objRsParams
                // var obj={};
                // obj.ATMTDTS = attachmentdetails;

            var jparsestr = JSON.stringify(attachmentdetails);
            // var result= JSON.parse(jparse) 
            jparse = JSON.parse(jparsestr);
        };



        function FileDetails() {
            this.FileList = [];
        };

        function AttachmentDetails() {
            this.APPSTS_ID = '';
            this.APP_ID = '';
            this.DT_CODE = '';
            this.DTT_CODE = '';
            this.FILE_COUNT = '';
            this.LOGINFO = '';
            this.NEED_ENCRYPTION = '';
            this.RS_DB_INFO = '';
            this.RS_STORAGE_TYPE = '';
            this.RSPARAMS = '';
            this.S_ID = '';
            this.WFTPA_ID = '';
            this.LOGIN_NAME = '';
            this.SYSTEM_DESC = '';
            this.SYSTEM_ID = '';
            this.TRN_ID = '';
            this.ATMT_DT_CODE = '';
            this.PARENTKEYCOLUMN = '';
            this.PARENTKEYVALUE = '';
            this.SOURCE = '';
            this.SOURCE_DETAILS = '';
            this.Grouping_mode = '';
            this.Multiset_relativepath = '';
            this.FOLDER_DTT_CODE = '';
            this.FOLDER_TRN_ID = '';
            this.PDF_STATUS = '';
            this.PDFATTACH_CATEGORY = '';
        };

        function LOGINFO() {
            this.APP_ID = '';
            this.APP_DESC = '';
            this.USER_ID = '';
            this.USER_NAME = '';
            this.SYSTEM_ID = '';
            this.SYSTEM_DESC = '';
            this.HANDLER_CODE = '';
            this.SESSION_ID = '';
            this.MENU_ITEM_DESC = '';
            this.CLIENT_ID = '';
            this.ACTION_DESC = '';
        };

        function RS_PARAMS() {
            this.privatItems = [];
        };

        function Items() {
            this.RS_CODE = '';
            this.RELATIVE_PATH = '';
            this.FILE_NAME = '';
            this.RS_PATH = '';
            this.ATMT_DTT_CODE = '';
            this.DTTA_ID = '';
            this.DTTAD_ID = '';
            this.DTTADIF_ID = '';
            this.TRN_ID = '';
            this.FILE_SIZE = '';
            this.COMMENT = '';
            this.AT_CODE = '';
            this.DTTAC_DESC = '';
            this.PARENT_TRN_ID = '';
        };

    });

});

module.exports = router;