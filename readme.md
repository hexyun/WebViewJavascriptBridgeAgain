### ios端需要引入WebViewJavascriptBridge包,安卓不需要,地址如下
https://github.com/lunaticss/WebViewJavascriptBridge.git
文件需要在页面加载之前就引入,ios的包需要在WebViewJavascriptBridge之前就引入,否则内部拿不到挂载在window上的对象

### 方法对照
#### 自定义
titleBartitleBar({text:'',style:{},show:true})
text:文字，style样式(需要和移动端说明)
show是否显示标题栏
#### 自定义titleBar上左右两侧按钮的功能及样式 
titleButton({text:'',style:{}})
text:文字，stle样式
#### 跳转页面
open({url:'',close:false}) 
url:页面路径或者标识,close:是否关闭当前页
#### 关闭自身webview,刷新上一页 
close(0, {refresh:false}) 
refresh:true刷新上一页 默认refresh为false
#### 关闭前n个webview
close(n)
n>0
#### 监听resume、pause事件
resume()pause()
#### 下拉刷新
pulltorefresh({open:false})
open:是否开启下拉刷新
#### app唤起
call({app:'wechat'})
app:需要唤起的app标识
#### 页面分享（微信、微博分享）
share({target:'wechat'})
target:分享渠道
#### 登录SDK页面呼启
login()
#### 支付功能
pay()
#### 定位信息获取
position()
#### 调用相机
camera()
#### 上传
upload()
#### 注销
logout()
退出跳转到登陆页
#### 扫码
scan()

其中具体哪些方法不支持需要询问移动端小朋友,罗列的是网上找到的一些方法