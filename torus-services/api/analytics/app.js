/*
    @Service name       : Analytics,
    @Description        : This is a main file for all api calls in this service,
    @Number of API's    : 49
*/

// Require dependencies
var reqInstanceHelper = require('../../../torus-references/common/InstanceHelper');
var servicePath = 'Analytics';

// Include the cluster module
var reqCluster = require('cluster');
// Code to run if we're in the master process
if (!reqCluster.isMaster) {
    // Count the machine's CPUs
    var cpuCount = require('os').cpus().length;
    // Create a worker for each CPU
    for (var i = 0; i < cpuCount; i += 1) {
        reqCluster.fork();
    }
    // Listen for dying workers
    reqCluster.on('exit', function (worker) {
        // Replace the dead worker, we're not sentimental
        console.log('Worker %d died :(', worker.id);
        reqCluster.fork();
    });
    // Code to run if we're in a worker process
} else {
    var reqEvents = require('events');
    var reqAppHelper = require('../../../torus-references/instance/AppHelper');


    var objEvents = new reqEvents();
    objEvents.on('EventAfterInit', AfterInitDBListener);
    process.title = 'Torus_Svc_Analytics';
    reqAppHelper.LoadAllInstanses(servicePath, function (pResult) {
        reqInstanceHelper.PrintInfo(servicePath, 'Instances loaded successfully.', null);
                objEvents.emit('EventAfterInit');
    });


    function AfterInitDBListener() {
        var arrRoutes = [];

          var reqaddproject = require('./routes/addproject.js');
		var reqcassandraconfigsave = require('./routes/cassandraconfigsave.js');
		var reqcassandrakeys = require('./routes/cassandrakeys.js');
		var reqgetallconnections = require('./routes/getallconnections.js');
		var reqkafkaconfigsave = require('./routes/kafkaconfigsave.js');
		var reqkafkakeys = require('./routes/kafkakeys.js');
		var reqmapconnects = require('./routes/mapconnects.js');
		var reqmapupdate = require('./routes/mapupdate.js');
		var reqmetabaseintegration = require('./routes/metabaseintegration.js');
		var reqprojects = require('./routes/projects.js');
		var reqrdbmsconfigsave = require('./routes/rdbmsconfigsave.js');
		var reqrdbmskeys = require('./routes/rdbmskeys.js');
		var reqsparkconfigsave = require('./routes/sparkconfigsave.js');
		var reqsparkkeys = require('./routes/sparkkeys.js');
		var Insertqueryexecdetails = require('./routes/queryexecdetails.js');
       var Getdatasourceconfig = require('./routes/getdatasourceconfigs.js');
        var Getdatalakeconfig = require('./routes/getdatalakeconfigs.js');
        var Getprjctdetailfetch = require('./routes/prjctdetailfth.js');
        var Getexecutedquerydetails = require('./routes/queryexecdetailfetch.js');
        var Getsparkmasterlist = require('./routes/getsparklist.js');
        var Getkafkamastconfig = require('./routes/getkafkamastconfig.js');
        var Getkafkatopiclist = require('./routes/getkafkatopiclist.js');
		var csvuploadfordatasource = require('./routes/Upload.js');
        var reqquerylistfetch=require('./routes/querylistfetch.js')

        var reqCreateGroup = require('./routes/creategroup.js');
        var reqGetProjects=require('./routes/getprojects.js')
        var reqCreateGroupFlow=require('./routes/creategroupflow.js')
        var reqInsertParamsPg=require('./routes/insertparamspg.js')
        var reqLoadGroup=require('./routes/loadgroup.js')
        var reqLoadGroupFlow=require('./routes/loadgroupflow.js')
        var reqRunFlow=require('./routes/runflow.js')
        var reqTcpKeys=require('./routes/tcpkeys.js')
        var reqStreamLogInfo=require('./routes/streamloginfo.js')
        var reqStreamStatus=require('./routes/streamstatus.js')
        var getprjctfrgrp = require('./routes/getprjctsfrgrp.js');
        var getgrpfrgrpflw = require('./routes/getgrpfrgrpflw.js');
        var updateprjctgrp = require('./routes/updateprjctgrp.js');
        var updategrpflw = require('./routes/updategrpflw.js');
        var deleteprjctgrp = require('./routes/deleteprjctgrp.js')
        var deletegrpflw = require('./routes/deletegrpflw.js')

        var reqUpdateProcessId=require('./routes/updateprocessid.js')
        var reqGetProcessId=require('./routes/getprocessid.js')
        var reqGetStreamFlow=require('./routes/getstreamflow.js')
		var reqsupersetintegration=require('./routes/supersetintegration')
		var reqcreatesupersetuser=require('./routes/createsupersetuser')

        var reqdashboardprogramsinfo=require('./routes/dashboardprogramsinfo')
        var reqdashboardqueriesinfo=require('./routes/dashboardqueriesinfo')
        var reqdashboardmetabasequestionsinfo=require('./routes/metabasequestions')
        var reqdashboardsupersetquestionsinfo=require('./routes/supersetquestions')
        var reqdashboardhuequestionsinfo=require('./routes/huequestions')
        var reqGetsparkurl=require('./routes/getsparkurl.js')
        var reqkafkaconsumprocess=require('./routes/kafkaconsumprocess')
        var reqeditanalyticalproject=require('./routes/editanalyticalproject')
        var reqrdbmseditkey=require('./routes/rdbmseditkey')
        var reqkafkaeditkey=require('./routes/kafkaeditkey')
        var reqcassandraeditkey=require('./routes/cassandraeditkey')
        var reqsparkeditkey=require('./routes/sparkeditkey')
        var reqrdbmsconfigupdate=require('./routes/rdbmsconfigupdate')
        var reqkafkaconfigupdate=require('./routes/kafkaconfigupdate')
        var reqcassandraconfigupdate=require('./routes/cassandraconfigupdate')
        var reqsparkconfigupdate=require('./routes/sparkconfigupdate')
        var reqcreatemetabaseuser=require('./routes/createmetabaseuser')
		var reqhueintegration=require('./routes/hueintegration')
        var reqcreatehueuser=require('./routes/createhueuser')
        var reqmetabaseuserdelete=require('./routes/metabaseuserdelete')
        var reqsupersetuserdelete=require('./routes/supersetuserdelete')
        var reqhueuserdelete=require('./routes/hueuserdelete')
		var reqprojectdelete=require('./routes/projectdelete')
        var kafkaconnectiondelete=require('./routes/kafkaconnectiondelete')
        var cassandraconnectiondelete=require('./routes/cassandraconnectiondelete')
        var sparkconnectiondelete=require('./routes/sparkconnectiondelete')
        var rdbmsconfigdelete=require('./routes/rdbmsconfigdelete')

        var IntegrateThirdParty = require('./routes/IntegrateTP')
        var syncMetaBase = require('./routes/syncmetabase');
        var syncmetabasequestions = require('./routes/syncmetabasequestions')
        var checkanalyticsenv = require('./routes/checkanalyticsenv')

        arrRoutes.push(rdbmsconfigdelete);
        arrRoutes.push(sparkconnectiondelete);
        arrRoutes.push(cassandraconnectiondelete);
        arrRoutes.push(kafkaconnectiondelete);
        arrRoutes.push(reqprojectdelete);
        arrRoutes.push(reqhueuserdelete);
        arrRoutes.push(reqsupersetuserdelete);
        arrRoutes.push(reqmetabaseuserdelete);
		arrRoutes.push(reqquerylistfetch);
        arrRoutes.push(reqaddproject);
		arrRoutes.push(reqcassandraconfigsave);
		arrRoutes.push(reqcassandrakeys);
		arrRoutes.push(reqgetallconnections);
		arrRoutes.push(reqkafkaconfigsave);
		arrRoutes.push(reqkafkakeys);
		arrRoutes.push(reqmapconnects);
		arrRoutes.push(reqmapupdate);
	    arrRoutes.push(reqmetabaseintegration);
		arrRoutes.push(reqprojects);
		arrRoutes.push(reqrdbmsconfigsave);
		arrRoutes.push(reqrdbmskeys);
		arrRoutes.push(reqsparkconfigsave);
		arrRoutes.push(reqsparkkeys);
        arrRoutes.push(Insertqueryexecdetails);
        arrRoutes.push(Getdatasourceconfig);
        arrRoutes.push(Getdatalakeconfig);
        arrRoutes.push(Getprjctdetailfetch);
        arrRoutes.push(Getexecutedquerydetails);
        arrRoutes.push(Getsparkmasterlist);
        arrRoutes.push(Getkafkamastconfig);
        arrRoutes.push(Getkafkatopiclist);
		arrRoutes.push(csvuploadfordatasource);

        arrRoutes.push(reqCreateGroup);
        arrRoutes.push(reqGetProjects);
        arrRoutes.push(reqTcpKeys);
        arrRoutes.push(reqCreateGroupFlow);
        arrRoutes.push(reqInsertParamsPg);
        arrRoutes.push(reqLoadGroup);
        arrRoutes.push(reqLoadGroupFlow);
        arrRoutes.push(reqRunFlow);
        arrRoutes.push(reqUpdateProcessId);
        arrRoutes.push(reqGetProcessId);
        arrRoutes.push(reqGetStreamFlow);
		arrRoutes.push(reqsupersetintegration);
		arrRoutes.push(reqcreatesupersetuser);
		arrRoutes.push(reqhueintegration);
		arrRoutes.push(reqcreatehueuser);

        arrRoutes.push(reqdashboardprogramsinfo);
        arrRoutes.push(reqdashboardqueriesinfo);
        arrRoutes.push(reqdashboardmetabasequestionsinfo);
        arrRoutes.push(reqdashboardsupersetquestionsinfo);
        arrRoutes.push(reqdashboardhuequestionsinfo);
        arrRoutes.push(reqGetsparkurl);
        arrRoutes.push(reqkafkaconsumprocess);
        arrRoutes.push(getprjctfrgrp);
        arrRoutes.push(getgrpfrgrpflw);
        arrRoutes.push(updateprjctgrp);
        arrRoutes.push(updategrpflw);
        arrRoutes.push(deleteprjctgrp);
        arrRoutes.push(deletegrpflw);

		arrRoutes.push(reqeditanalyticalproject);
        arrRoutes.push(reqrdbmseditkey);
        arrRoutes.push(reqkafkaeditkey);
        arrRoutes.push(reqcassandraeditkey);
        arrRoutes.push(reqsparkeditkey);
        arrRoutes.push(reqrdbmsconfigupdate);
        arrRoutes.push(reqkafkaconfigupdate);
        arrRoutes.push(reqcassandraconfigupdate);
        arrRoutes.push(reqsparkconfigupdate);
        arrRoutes.push(reqStreamLogInfo);
        arrRoutes.push(reqStreamStatus);
        arrRoutes.push(reqcreatemetabaseuser)
        
        arrRoutes.push(IntegrateThirdParty)
        arrRoutes.push(syncMetaBase)
        arrRoutes.push(syncmetabasequestions)
        arrRoutes.push(checkanalyticsenv)

        reqAppHelper.StartService(servicePath, arrRoutes, __dirname);
    }
}
/******** End of File *******/
