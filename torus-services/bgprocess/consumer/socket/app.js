/*
    @Service name       : Socket,
    @Description        : This is a main file for all api calls in this service,
    @Number of API's    : 2
*/

// Require dependencies
var servicePath = 'Socket';

// Include the cluster modules
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
        // 6Replace the dead worker, we're not sentimental
        console.log('Worker %d died :(', worker.id);
        reqCluster.fork();
    });
    // Code to run if we're in a worker process
} else {
    var reqAppHelper = require('../../../../torus-references/instance/AppHelper');
    var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
    var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
    var reqEvents = require('events');
    var objEvents = new reqEvents();
    objEvents.on('EventAfterInit', AfterInitDBListener);
    process.title = 'Torus_Bg_SocketConsumer';
    // reqAppHelper.LoadAllInstanses(servicePath, function(pResult) {
    //     if (pResult == 'SUCCESS') {
    //         reqInstanceHelper.PrintInfo(servicePath, 'Instances loaded successfully.', null);
    //         objEvents.emit('EventAfterInit');
    //     }
    // });

    reqInstanceHelper.GetConfig('SERVICE_MODEL', function (ResSvcModel) {
        reqDBInstance.LoadServiceModel('SERVICE_MODEL', JSON.parse(ResSvcModel), function (res) {
            reqInstanceHelper.PrintInfo(servicePath, 'Instances loaded successfully.', null);
            objEvents.emit('EventAfterInit');
        });
    })

    function AfterInitDBListener() {
        var arrRoutes = [];

        var reqPing = require('./routes/Ping');
        var reqEmitMsg = require('./routes/EmitMessage');

        arrRoutes.push(reqPing);
        arrRoutes.push(reqEmitMsg);

        reqAppHelper.StartService(servicePath, arrRoutes, __dirname);

        var reqSocketHelper = require('./routes/helper/SocketHelper')
        reqSocketHelper.ConnectSocket();
    }
}
/******** End of File *******/
