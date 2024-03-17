var reqExpress = require('express');
var router = reqExpress.Router();
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var mTranDB = '';
router.post('/AttachDetachProcess', function (pReq, pResp, next) {
    var Strrelativepath = pReq.body.RELATIVE_PATH;
    var strtype = pReq.body.TYPE;
    var strtrn_id = pReq.body.trn_id;
    var Attachclaimno = pReq.body.Attachclaimno;
    var oldclaimno = pReq.body.oldclaimno;
    var trna_idvalue = pReq.body.TRNA_ID;
    var month = pReq.body.month;
    var year = pReq.body.year;
    var providerid = pReq.body.providerid;
    var treatmenttype = pReq.body.treatmenttype;
    var membername = pReq.body.membername;
    var clientname = pReq.body.clientname;
    var invoiceno = pReq.body.invoiceno;

    if (strtype == 'link' || strtype == 'link1') {
        var treatetype = '';
        var memname = '';
        var clientnam = '';
        var invoice = '';

        if (treatmenttype != '') {
            treatetype = " , ncp_treatment_type='" + treatmenttype + "'";
        } else {
            treatetype = '';
        }

        if (membername != '') {
            memname = " , ncp_member_name='" + membername + "'";
        } else {
            memname = '';
        }

        if (clientname != '') {
            clientnam = " , ncp_client_name='" + clientname + "'";
        } else {
            clientnam = '';
        }

        if (invoiceno != '') {
            invoice = " , ncp_invoice_no='" + invoiceno + "'";
        } else {
            invoice = '';
        }

    }

    //  var orphantype = req.body.orphantype;
    var pHeader = pReq.headers;

    var objLogInfo = reqLogInfo.AssignLogInfoDetail(pReq.body, pReq);
    reqTranDBInstance.GetTranDBConn(pHeader, false, function (pSession) {
        mTranDB = pSession;

        var TRNA_ID = "";
        var TRN_ID = "";
        var status = "";
        var findtrn_idquery = '';
        var elistatus = '';
        if (strtype == 'ORPHAN') {
            var updatetrnaid = "update trn_attachments set checked_out_by_name = 'ORPHAN'  where trna_id = '" + trna_idvalue + "'";
            reqTranDBInstance.ExecuteSQLQuery(mTranDB, updatetrnaid, objLogInfo, function (pResult, pErr) {
                pResp.send('SUCCESS');
            });
        }

        if (strtype == 'OCR' || strtype == 'ATTACH') {
            findtrn_idquery = "select *  from trn_attachments where relative_path = '" + Strrelativepath + "' ";
        }
        else if (strtype == 'DETECHTRAN' || strtype == 'ATTACHTRAN') {
            findtrn_idquery = "select tncd_id  from trn_nlic_claim_details where ncp_claim_no = '" + oldclaimno + "' ";
        } else if (strtype == 'link' || strtype == 'link1' || strtype == 'dataentry') {
            if (strtype == 'link' || strtype == 'link1') {
                elistatus = " and status='SCANNED'";
            } else if (strtype == 'dataentry') {
                elistatus = " and status='PENDING'";
            }

            findtrn_idquery = "select tncd_id  from trn_nlic_claim_details where  ncp_claim_no = '" + oldclaimno + "'" + elistatus;
        }

        reqTranDBInstance.ExecuteSQLQuery(mTranDB, findtrn_idquery, objLogInfo, function (pattachResult, pErr) {
            if (pattachResult.rows.length == 0) {
                pResp.send("SUCCESS");
            } else {
                var arrRSPItem = [];
                for (var j = 0; j < pattachResult.rows.length; j++) {
                    if (strtype == 'OCR' || strtype == 'ATTACH') {
                        TRNA_ID = pattachResult.rows[j].trna_id;
                        TRN_ID = pattachResult.rows[j].trn_id;
                    }
                    else if (strtype == 'DETECHTRAN' || strtype == 'ATTACHTRAN') {
                        TRN_ID = pattachResult.rows[j].tncd_id;
                    }
                    else if (strtype == 'link' || strtype == 'link1' || strtype == 'dataentry') {
                        TRN_ID = pattachResult.rows[j].tncd_id;
                    }
                }
                if (strtype == 'ATTACH') {
                    _InsATMT(pattachResult.rows);
                }
            }


            if (strtype == 'OCR') {
                status = 'INDEXED';
                var updatetrnaid = "update trn_attachments set checked_out_by_name = '" + status + "'  where trna_id = '" + trna_idvalue + "'";
                reqTranDBInstance.ExecuteSQLQuery(mTranDB, updatetrnaid, objLogInfo, function (pResult, pErr) {
                    pResp.send('SUCCESS');
                });
            }
            else if (strtype == 'ATTACH') {
                status = 'DELETED';
                var updatetrnaid = "update trn_attachments set checked_out_by_name = '" + status + "'  where trna_id = '" + TRNA_ID + "'";
                reqTranDBInstance.ExecuteSQLQuery(mTranDB, updatetrnaid, objLogInfo, function (pResult, pErr) {
                    pResp.send('SUCCESS');
                });
            }
            else if (strtype == 'DETECHTRAN') {
                var updatetrnaid = "update trn_nlic_claim_details set status = 'SCANNED'  where tncd_id = '" + TRN_ID + "'";
                reqTranDBInstance.ExecuteSQLQuery(mTranDB, updatetrnaid, objLogInfo, function (pResult, pErr) {
                    pResp.send('SUCCESS');
                });
            }
            else if (strtype == 'ATTACHTRAN') {
                var updatetrnaid = "update trn_nlic_claim_details set status='CREATED',ncp_claim_no = '" + Attachclaimno + "'  where tncd_id = '" + TRN_ID + "'";
                reqTranDBInstance.ExecuteSQLQuery(mTranDB, updatetrnaid, objLogInfo, function (pResult, pErr) {
                    pResp.send('SUCCESS');
                });
            }
            else if (strtype == 'link' || strtype == 'link1' || strtype == 'dataentry') {
                if (strtype == 'link' || strtype == 'link1') {
                    var updatetrnaid = "update trn_nlic_claim_details set status='COMPLETED' " + treatetype + memname + clientnam + invoice + "  where tncd_id = '" + TRN_ID + "'";
                }
                if (strtype == 'dataentry') {
                    var updatetrnaid = "update trn_nlic_claim_details set status='COMPLETED'  where tncd_id = '" + TRN_ID + "'";
                }
                reqTranDBInstance.ExecuteSQLQuery(mTranDB, updatetrnaid, objLogInfo, function (pResult, pErr) {
                    pResp.send('SUCCESS');
                });
            }


        });


    });

    function _InsATMT(arrRSPItem) {
        try {

            findtrn_idquery = "select tncd_id  from trn_nlic_claim_details where ncp_claim_no = '" + Attachclaimno + "' ";
            reqTranDBInstance.ExecuteSQLQuery(mTranDB, findtrn_idquery, objLogInfo, function (pattachResult, pErr) {
                if (pattachResult.rows.length == 0) {
                    pResp.send("SUCCESS");
                } else {
                    strtrn_id = pattachResult.rows[0].tncd_id;
                    var arrTableIns = [];
                    var objTabValue = {};
                    objTabValue.RELATIVE_PATH = arrRSPItem[0].relative_path;
                    objTabValue.ORIGINAL_FILE_NAME = arrRSPItem[0].original_file_name;
                    objTabValue.FILE_SIZE = arrRSPItem[0].file_size;
                    objTabValue.RESOURCE_SERVER_CODE = arrRSPItem[0].resource_server_code;
                    objTabValue.AT_CODE = arrRSPItem[0].at_code;
                    objTabValue.COMMENT_TEXT = arrRSPItem[0].comment_text;
                    objTabValue.ATMT_DTT_CODE = arrRSPItem[0].atmt_dtt_code;
                    objTabValue.DTTA_ID = arrRSPItem[0].dtta_id;
                    objTabValue.DTTAD_ID = arrRSPItem[0].dttad_id;
                    objTabValue.DTTADIF_ID = arrRSPItem[0].dttadif_id;
                    objTabValue.DTTAC_DESC = arrRSPItem[0].dttac_desc;
                    objTabValue.ATMT_TS_ID = arrRSPItem[0].atmt_ts_id;
                    objTabValue.ATMT_TRN_ID = arrRSPItem[0].atmt_trn_id;
                    objTabValue.AT_DESCRIPTION = arrRSPItem[0].at_description;
                    objTabValue.ATTACHMENT_TITLE = arrRSPItem[0].attachment_title;
                    objTabValue.checked_out_by_name = 'CREATED';
                    objTabValue.TOTAL_PAGES = '0';
                    objTabValue.IS_CURRENT = 'Y';
                    objTabValue.IS_DELETED = 'N';
                    objTabValue.SOURCE = arrRSPItem[0].source;
                    objTabValue.SOURCE_DETAILS = arrRSPItem[0].source_details;
                    objTabValue.SYSTEM_ID = arrRSPItem[0].system_id;
                    objTabValue.SYSTEM_NAME = arrRSPItem[0].system_name;
                    objTabValue.DT_CODE = arrRSPItem[0].dt_code;
                    objTabValue.DTT_CODE = arrRSPItem[0].dtt_code;
                    objTabValue.VERSION_NO = '0';
                    objTabValue.MODIFIED_BY = arrRSPItem[0].modified_by;
                    objTabValue.TRN_ID = strtrn_id;
                    objTabValue.GROUP_ID = arrRSPItem[0].group_id;
                    objTabValue.APP_ID = objLogInfo.APP_ID;
                    objTabValue.TENANT_ID = objLogInfo.TENANT_ID;
                    arrTableIns.push(objTabValue);

                    reqTranDBInstance.InsertTranDBWithAudit(mTranDB, 'TRN_ATTACHMENTS', arrTableIns, objLogInfo, function (pResult) {
                        try {
                            if (pResult) {
                                console.log('TRN_ATTACHMENTS Table Inserted');
                                var strResult = 'SUCCESS';
                            } else {
                                //    reqTranDBHelper.Commit(mTranDB, false);
                            }
                        } catch (error) {
                            printError(error);
                        }

                    });
                }
            });
        } catch (error) {
            printError(error);
        }
    }

    function printError(pErr) {
        console.log(pErr.stack);
    }
});
module.exports = router;