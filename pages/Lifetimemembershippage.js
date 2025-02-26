var customlocator = require('..//util//customlocator.js');
var SelectWrapper = require('..//util//select-wrapper.js');
var obj =require('../Object2.json');

var liftimembershippage = function(){
 
    this.gotolifetimemembershippage = function(){

        browser.sleep(1000);
        element(by.xpath("(//a[@class='btn btn-primary btn-lg'])[2]")).click();
        browser.sleep(1000);
    };
    this.gotolinkdinpage = function(){

        browser.sleep(1000);
        element(by.xpath("(//span[@class='ahfb-svg-iconset ast-inline-flex svg-baseline'])[2]")).click();
        browser.sleep(3000);
        browser.getAllWindowHandles().then(function(handles){

            browser.switchTo().window(handles[1]).then(function(){

                browser.getTitle().then(function(text){

                    console.log("Second window title = "+text);
                });


            });

            browser.switchTo().window(handles[0]).then(function(){

                browser.getTitle().then(function(text){

                    console.log("First window title = "+text);
                });

            });


        });
    };


};
module.exports = new liftimembershippage();