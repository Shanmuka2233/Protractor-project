var customlocator = require('..//util//customlocator.js');
var SelectWrapper = require('..//util//select-wrapper.js');
var mySelect = new SelectWrapper(by.model("custId"));
var myNumber = new SelectWrapper(by.model("accountNo"));
var obj =require('../Object.json');

var customerinfo = function() {


    this.customerlogin = function(){
        
        element(by.ngClick(obj.locators.sampleformpage.testdata.customerinfo.customerclick)).click();
       
    };
    this.gotocustomer = function(){
        mySelect.selectByValue(3);
        element(by.css(obj.locators.sampleformpage.testdata.customerinfo.gotocustomer)).click();
        
    };
    this.verifytitle = function(){
     
     
       element(by.css(obj.locators.sampleformpage.testdata.customerinfo.verifytitle)).getText().then(function(text){

        console.log(text);
        browser.sleep(2000);
    });
    };

    this.selectnumber = function(){
        myNumber.selectByValue(obj.locators.sampleformpage.testdata.customerinfo.selectnumber);
        browser.sleep(2000);
    }
    this.verifytext = function(){
        element(by.xpath(obj.locators.sampleformpage.testdata.customerinfo.resulttmes0)).getText().then(function(text){

            console.log(text);
            browser.sleep(2000);
        });
        expect(element(by.xpath(obj.locators.sampleformpage.testdata.customerinfo.resulttmes0)).getText()).toEqual(obj.locators.sampleformpage.testdata.customerinfo.resulttext0);
    }

    this.gotowithdrawl = function(){
        element(by.ngClick(obj.locators.sampleformpage.testdata.customerinfo.customerwithdrawl.withdrawl)).click();
        browser.sleep(1000);
    }
    this.enteramount = function(){
       
        element(by.xpath(obj.locators.sampleformpage.testdata.customerinfo.customerwithdrawl.enteramount)).sendKeys(obj.locators.sampleformpage.testdata.customerinfo.customerwithdrawl.amount);
    }
    this.clickwithdrawl =function(){
        element(by.xpath(obj.locators.sampleformpage.testdata.customerinfo.customerwithdrawl.clickwithdrawl)).click();
    }
    this.resultmessage =function(){
        element(by.xpath(obj.locators.sampleformpage.testdata.customerinfo.customerwithdrawl.resultmes1)).getText().then(function(text){

        console.log(text);

        });
        expect(element(by.xpath(obj.locators.sampleformpage.testdata.customerinfo.customerwithdrawl.resultmes1)).getText()).toEqual(obj.locators.sampleformpage.testdata.customerinfo.customerwithdrawl.resulttext1);
        browser.sleep(1000);
    }


    this.gotodeposit = function(){
        element(by.ngClick(obj.locators.sampleformpage.testdata.customerinfo.customerwithdrawl.customerdeposit.clickdiposit)).click();
        browser.sleep(1000);
    }
    this.enteramount0 = function(){
       
        element(by.xpath(obj.locators.sampleformpage.testdata.customerinfo.customerwithdrawl.customerdeposit.enteramount0)).sendKeys(obj.locators.sampleformpage.testdata.customerinfo.customerwithdrawl.customerdeposit.amount0);
    }
    this.clickwithdrawl0 =function(){
        element(by.xpath(obj.locators.sampleformpage.testdata.customerinfo.customerwithdrawl.customerdeposit.clickwithdrawl0)).click();
    }
    this.resultmessage0 =function(){
        element(by.xpath(obj.locators.sampleformpage.testdata.customerinfo.customerwithdrawl.customerdeposit.resultmes2)).getText().then(function(text){

        console.log(text);

        });
        expect(element(by.xpath(obj.locators.sampleformpage.testdata.customerinfo.customerwithdrawl.customerdeposit.resultmes2)).getText()).toEqual(obj.locators.sampleformpage.testdata.customerinfo.customerwithdrawl.customerdeposit.resulttext2);
        browser.sleep(1000);

};
this.gototransactions = function(){
   
    element(by.ngClick(obj.locators.sampleformpage.testdata.customerinfo.customerwithdrawl.customerdeposit.customertransaction.clicktransaction)).click();
    browser.sleep(1000);
}
this.verifymessage1 = function(){

    element.all(by.xpath("//tr[@class='ng-scope']")).getText().then(function(text){
        console.log(text);
});

}



};



module.exports = new customerinfo();