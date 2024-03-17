var reqExpress = require('express');
var router = reqExpress.Router();
var reqDBInstance = require('../../../references/helper/CassandraInstance');
var reqCassandraInstance = require('../../../references/helper/CassandraInstance');
var reqLogInfo = require('../../../references/log/LogInfo');
var reqLogWriter = require('../../../references/log/LogWriter');
var reqSaveList = require('../routes/Sharepoint/SaveList');
var reqsavesharepointdata = require('./savesharepointdata');
var StringBuilder = require("string-builder");
var reqTranDBHelper = require('../../../references/helper/TranDBInstance');
var reqTranDBInstance = require('../../../references/helper/TranDBInstance');



var mTranDB = '';
router.post('/UploadFiles', function(pReq, pResp, next) {
    var StrRsParams = pReq.body.RELATIVE_PATH;
    var DT_CODE = pReq.body.DT_CODE;
    var Attach_Category = pReq.body.ATTACH_CATEGORY;
    var KEYVALUE = pReq.body.KEYVALUE;
    var spu_id = pReq.body.SPU_ID;
    var dynamicdata = pReq.body.DYNAMICDATA;
    var BYTEDATA = pReq.body.FILECONTENT;
    var dynamicresult = '';
    console.log(dynamicdata);
    if (dynamicdata != undefined && dynamicdata != '') {
        dynamicresult = JSON.parse(dynamicdata);
    }

    var foldertablename = pReq.body.FOLDERTBLNAME;
    var APP_ID = pReq.body.APP_ID;
    if (foldertablename == undefined || foldertablename == '') {
        foldertablename = 'TRN_NLC_FOLDERS';
    }
    if (APP_ID == undefined || APP_ID == '') {
        APP_ID = '10';
    }

    //  var dynamicresult = "";
    console.log(StrRsParams);
    var SaveAttachmentDetail = JSON.parse(StrRsParams);
    var atmt_dtt_code = SaveAttachmentDetail.items[0].ATMT_DTT_CODE;
    var relative_path = SaveAttachmentDetail.items[0].RELATIVE_PATH;

    var FOLDER_TRN_ID = '';
    var FOLDER_DTT_CODE = '';
    var dt_code = '';
    var objLogInfo = reqLogInfo.AssignLogInfoDetail(pReq.body, pReq);
    reqTranDBInstance.GetTranDBConn(pReq.headers, false, function(pSession)

        {

            mTranDB = pSession;

            var findtrn_idquery = " select TRNF_id,Dt_code,dtt_code from  " + foldertablename + " WHERE DTG_CODE='" + atmt_dtt_code + "'";
            reqTranDBHelper.ExecuteSQLQuery(mTranDB, findtrn_idquery, objLogInfo, function(pResult, pErr) {

                if (pResult.rows.length == 0) {
                    console.log('key_column not found", "ERR-FX-133402');
                } else {

                    for (var j = 0; j < pResult.rows.length; j++) {
                        FOLDER_TRN_ID = pResult.rows[0].trnf_id;
                        FOLDER_DTT_CODE = pResult.rows[0].dtt_code;
                        dt_code = pResult.rows[0].Dt_code;
                    }

                }




                var arrattachmenttypes = [];
                var arrAtmts = [];
                var FileList = [];
                //AttachmentDetails = {};
                var objloginfo = {};
                var LOGINFO = {};
                LOGINFO.APP_ID = APP_ID;
                LOGINFO.APP_DESC = 'SHAREPOINT';
                LOGINFO.USER_ID = '10';
                LOGINFO.USER_NAME = 'IFRAS_MAKER';
                LOGINFO.SYSTEM_ID = '10';
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
                attachmentdetails.APP_ID = APP_ID;
                attachmentdetails.DT_CODE = DT_CODE;
                attachmentdetails.SPU_ID = spu_id;
                attachmentdetails.DTT_CODE = atmt_dtt_code;
                attachmentdetails.ATMT_DT_CODE = '';
                attachmentdetails.FILE_COUNT = '1';
                attachmentdetails.FOLDER_DTT_CODE = FOLDER_DTT_CODE;
                attachmentdetails.FOLDER_TRN_ID = FOLDER_TRN_ID;
                attachmentdetails.Grouping_mode = 'SINGLE_SET';

                attachmentdetails.LOGINFO = objloginfo.LOGINFO;

                attachmentdetails.NEED_ENCRYPTION = '';
                attachmentdetails.RS_DB_INFO = '';
                attachmentdetails.RS_STORAGE_TYPE = '';
                attachmentdetails.RSPARAMS = '';
                attachmentdetails.S_ID = '10';
                attachmentdetails.WFTPA_ID = '0';

                attachmentdetails.LOGIN_NAME = 'IFRAS_MAKER';
                attachmentdetails.TRN_ID = '';
                attachmentdetails.PARENTKEYCOLUMN = 'TRNF_ID';
                attachmentdetails.PARENTKEYVALUE = '0';
                attachmentdetails.SOURCE = 'SCAN';
                attachmentdetails.SOURCE_DETAILS = 'SHAREPOINT';
                attachmentdetails.Multiset_relativepath = '';
                attachmentdetails.PDF_STATUS = '';
                attachmentdetails.PDFATTACH_CATEGORY = '';
                attachmentdetails.CHECKED_OUT_BY_NAME = 'CREATED';

                var objRsParams = {}
                var arrItems = [];
                var Items = {};
                Items.RS_CODE = '';
                Items.RELATIVE_PATH = relative_path;
                Items.FILE_NAME = relative_path;
                Items.RS_PATH = '';
                Items.ATMT_DTT_CODE = atmt_dtt_code;
                Items.DTTA_ID = '1';
                Items.DTTAD_ID = '1';
                Items.DTTADIF_ID = '0';
                Items.TRN_ID = '';
                Items.FILE_SIZE = '';
                Items.COMMENT = '';
                Items.AT_CODE = SaveAttachmentDetail.items[0].AT_CODE;
                Items.DTTAC_DESC = 'General';
                Items.PARENT_TRN_ID = '0';
                arrItems.push(Items)

                objRsParams.Items = arrItems

                attachmentdetails.RSPARAMS = objRsParams
                    // var obj={};
                    // obj.ATMTDTS = attachmentdetails;

                var jparsestr = JSON.stringify(attachmentdetails);
                // var result= JSON.parse(jparse) 
                var jparse = JSON.parse(jparsestr);

                var img = {};
                img.FILE_NAME = relative_path;
                img.RELATIVE_PATH = relative_path;
                img.BYTE_DATA = BYTEDATA;
                img.AT_CODE = SaveAttachmentDetail.items[0].AT_CODE;
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

            });


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
                this.CHECKED_OUT_BY_NAME = '';
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