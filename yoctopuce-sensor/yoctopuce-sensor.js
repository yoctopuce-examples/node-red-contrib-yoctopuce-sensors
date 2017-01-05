module.exports = function (RED) {
    "use strict";
    var yoctolib = require('yoctolib-es');
    var YAPI = yoctolib.YAPI;
    var YAPIContext = yoctolib.YAPIContext;
    var YErrorMsg = yoctolib.YErrorMsg;
    var YSensor = yoctolib.YSensor;

    function UseYSensor(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        this.hostname = config.hostname;
        this.port = config.port;
        if (this.credentials) {
            this.username = this.credentials.user;
            this.password = this.credentials.password;
        } else {
            this.username = null;
            this.password = null;
        }
        if (this.username) {
            this.huburl = this.username + ":" + this.password + "@" + this.hostname + ":" + this.port.toString();
        } else {
            this.huburl = this.hostname + ":" + this.port.toString();
        }
        this.hwid = config.hwid;
        this.ysensor = null;
        this.yctx = new YAPIContext();
        function runit() {
            node.log("connect to " + node.hostname);
            let errmsg = new YErrorMsg();
            node.yctx.LogUnhandledPromiseRejections().then(() => {
                return node.yctx.DisableExceptions();
            }).then(() => {
                // Setup the API to use the VirtualHub on local machine
                return node.yctx.RegisterHub(node.huburl, errmsg);
            }).then((res) => {
                if (res != YAPI.SUCCESS) {
                    node.error('Cannot contact VirtualHub on 127.0.0.1: ' + errmsg.msg);
                    node.status({fill: "red", shape: "ring", text: "disconnected"});
                    return;
                }
                node.status({fill: "yellow", shape: "dot", text: "running"});
                // by default use any connected module suitable for the demo
                if (node.hwid) {
                    node.ysensor = YSensor.FindSensorInContext(node.yctx, node.hwid);
                } else {
                    node.ysensor = YSensor.FirstSensorInContext(node.yctx);
                }
                if (!node.ysensor) {
                    node.warn("No Sensor connected on " + node.hostname);
                    return;
                }
                node.ysensor.registerValueCallback(function (obj_fct, str_value) {
                    let msg = {payload: str_value,topic:node.name};
                    node.send(msg);
                });
                node.ysensor.isOnline().then((isonline) => {
                    if (!isonline) {
                        node.warn("No Sensor " + node.hwid + "connected on " + node.hostname);
                        return;
                    }
                    node.status({fill: "green", shape: "dot", text: "running"});
                });
            });

            node.on("close", function (done) {
                node.log("disconnected from " + node.hostname);
                node.yctx.FreeAPI().then(() => {
                    node.status({});
                    done();
                });

            });
        }

        runit();
    }

    RED.nodes.registerType("yoctopuce-sensor", UseYSensor, {
        credentials: {
            user: {type: "text"},
            password: {type: "password"}
        }
    });

}