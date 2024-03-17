var reqExpress = require('express');
var router = reqExpress.Router();
//var reqDBInstance = require('../../../../torus-references/helper/CassandraInstance');
//var reqCassandraInstance = require('../../../../torus-references/helper/CassandraInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var StringBuilder = require("string-builder");
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');


var mTranDB = '';
var objLogInfo = '';
router.post('/ViewDMSNlicFiles', function(req, res, next) {
  // reqCassandraInstance.GetCassandraConn(req.headers, 'dep_cas', function Callback_GetCassandraConn(mClient) {
  reqDBInstance.GetFXDBConnection(req.headers, 'dep_cas', objLogInfo, function Callback_GetCassandraConn(mClient) {

    var strOrm = 'knex';
    var DTT_Code = 'DTT_1304_1475833341484';
    var pDTCODE = 'DT_1304_1475833243317';
    var pTTARGET_TABLE = '';
    var pkeycolumn = '';
    var APP_ID = '12'; // req.body.APP_ID;
    var claim_no = req.body.claimno;
    var providerid = req.body.providerid;
    var memberid = req.body.memberid;
    var year = req.body.year;
    var month = req.body.month;
    var page = req.body.pageno;
    var Recordperpage = req.body.Recordperpage;
    var recordperpagedisplay = '10';
    var strtargetcolumn = '';
    var strtargetvalue = '';
    var pTTARGET_TABLE = '';
    var memberidcond = '';
    var TargetAction = req.body.TargetAction;
    var needgetlastdate = req.body.getlastdate;
    
   
if(needgetlastdate==undefined)
{
 needgetlastdate=''; 
}
console.log('needgetlastdate' );
  console.log(needgetlastdate);
         if(memberid !='' &&  memberid !='0')
         {
           memberidcond = " and member_id='" + memberid +"'" ;
         }
         else
         {
           memberidcond = '';
          }

      var orphantype = req.body.orphantype;
          if (claim_no==0){
                        claim_no='';
                    }
          if (providerid==0){
                        providerid='';
                    }

                   // Form condition for LOAD ATTACHMENT LIST
                     var ccondition ='';
                    var showpage =true;
                    if (claim_no !='' )
                     {
                          recordperpagedisplay = '20';    
                            showpage ="true";
                      if(providerid !='')
                       {
                               ccondition= " ncp_claim_no='"+ claim_no + "' and provider_id='"+ providerid + "' and ncp_year='"+ year + "' and ncp_month ='"+ month + "'" + memberidcond ;
                       }else{
                                 ccondition= " ncp_claim_no='"+ claim_no + "' and ncp_year='"+ year + "' and ncp_month ='"+ month + "'" ;
                       }
                    }
                     else
                     {
                       ccondition= " provider_id='"+ providerid + "' and ncp_year='"+ year + "' and ncp_month ='"+ month + "'" + memberidcond ;
                        showpage ="false";
                        recordperpagedisplay = '20';
                     }
                     
                                    
                    // To find trn_id value
                     var objLogInfo = reqLogInfo.AssignLogInfoDetail(req.body, req);
                     reqTranDBInstance.GetTranDBConn(req.headers, false, function(pSession)
                        {
                          
                          
                             mTranDB = pSession;
                             
                              if(needgetlastdate=='true')
          {
               var findgetlastdate = "select created_date from trn_attachments ORDER BY CREATED_DATE DESC  limit 1";
              console.log(findgetlastdate);
                  reqTranDBInstance.ExecuteQueryWithPagingCount(mTranDB, findgetlastdate,"1","1", objLogInfo, function(ptrnResult, pcount,perr)  { 
                console.log(findgetlastdate);
                if (ptrnResult.length == 0) {
                                    console.log('key_column not found", "ERR-FX-133402');
                                       var arr=[];
                                       res.send(arr);
                                 } 
                                 else {
                                   try {
                                   console.log('result 1');
								   console.log(ptrnResult.length);
								   console.log(ptrnResult[0]);
                                         var arr=[];
                                               var sfc={};
												sfc.datevalue =ptrnResult[0];
                                                arr.push(sfc);
                                                res.send(arr);  
                                 }
                               catch (error) {
                                errorHandler("ERR-FX-18807", error)
                                var arr=[];
                                res.send(arr);
                            }
                                 }
              });
          }
                            if (claim_no !='' ) {
                              // LOAD ATTACHMENT LIST
                              var status =" IN('CREATED','INDEXED') ";
                              if(orphantype=='ATTACHLEVELORPHAN')
                              {
                                status=" IN('ORPHAN')";
                              }

                             var findtrn_idquery = "select   status,ncp_claim_form_no,tncd_id,provider_id,relative_path,trn_id,trna_id,ncp_claim_no,ncp_year,ncp_month from trn_nlic_claim_details t inner join trn_attachments trna on trna.trn_id = t.tncd_id WHERE checked_out_by_name  " + status + " AND " + ccondition +" order by trna_id asc" ;
                            }
                            else
                              {
                          // LOAD cLAIM LIST  
                           var constatus='';
          if(TargetAction=='link' || TargetAction=='link1')
            {
              constatus = " and status='SCANNED'" ;
              recordperpagedisplay = '1';
            }
            else if(TargetAction=='dataentry')
            {
              constatus = " and status IN('PENDING') ";
              recordperpagedisplay = '1';
            }
          else
           {
              constatus = " and status IN('CREATED','ORPHAN','PENDING','SCANNED','COMPLETED') ";
            }

                                  if(providerid!=''){
                                     var findtrn_idquery = "select  status,ncp_claim_form_no,tncd_id,provider_id,ncp_claim_no,ncp_year,ncp_month from trn_nlic_claim_details where ncp_claim_no !='' and ncp_year='" + year +"' and provider_id='" + providerid  + "' and ncp_month='" + month +"'" + memberidcond + constatus;
                                   }else{
                                      var findtrn_idquery = "select  status,ncp_claim_form_no,tncd_id,provider_id,ncp_claim_no,ncp_year,ncp_month from trn_nlic_claim_details where ncp_claim_no !='' and ncp_year='" + year +"' and ncp_month='" + month +"'" + constatus ;
                                    }
                                      // LOAD cLAIM LIST  END
                               }
                     
                          
                            reqTranDBInstance.ExecuteQueryWithPagingCount(mTranDB, findtrn_idquery,page,recordperpagedisplay, objLogInfo, function(ptrnResult, pcount,perr) {
                               if (ptrnResult.length == 0) {
                                    console.log('key_column not found", "ERR-FX-133402');
                                       var arr=[];
                                       res.send(arr);
                                 } 
                                 else {
                                     var trnidvalues = '';
                                     var relativepathvalues = new StringBuilder();
                                  
                                    var arr=[];
                                   // Get Relativepath details
                                   for (var k = 0; k < ptrnResult.length; k++) {
                                                    //relativepathvalues.append(ptrnResult.rows[k]['relative_path'] + ",")
                                                    var sfc={};
                                                  if (claim_no !='' ){
                                                     sfc.KEYDATA=ptrnResult[k]['relative_path'];
                                                   }
                                                   sfc.trna_id=ptrnResult[k]['trna_id'];
                                                   sfc.Claims=ptrnResult[k]['ncp_claim_no'];
                                                   sfc.AT_CODE='IMG';
                                                   sfc.TNCD_ID=ptrnResult[k]['tncd_id'];
                                                   sfc.YEAR=ptrnResult[k]['ncp_year'];
                                                   sfc.MONTH=ptrnResult[k]['ncp_month'];
                                                   sfc.selectedFile = { "Name": ptrnResult[k]['ncp_claim_no']};
                                                  
                                                     sfc.selectedClient = { "Name": ptrnResult[k]['provider_id']};
                                                     sfc.documentYear =  ptrnResult[k]['ncp_year'];
                                                     sfc.documentMonth =  ptrnResult[k]['ncp_month'];
                                                     sfc.showpages=showpage;
                                                     sfc.pageName = " Page ";
                                                     sfc.transtatus =   ptrnResult[k]['status'];
                                                    if(showpage=='false')
                                                     {
                                                        sfc.pageName = "";
                                                     }
                                                      sfc.orphantype=orphantype;
                                                      sfc.totalpages = pcount;
                                                      sfc.recordperpagelist=recordperpagedisplay;
                                                   sfc.PageNo= k + 1;

                                                     arr.push(sfc);
                                                 }
                                            }
                                         res.send(arr);
                                });
                          });  

     });

    function errorHandler(errcode, message) {
       console.log(message, errcode);
         reqLogWriter.TraceError(objLogInfo, message, errcode);
     }
    
});

module.exports = router;