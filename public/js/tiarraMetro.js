// -*- mode:javascript -*-
// vim: ts=2 sw=2 sts=2 tw=80 et wrap ff=unix ft=javascript fenc=utf8 :

$(function(){
  /*
   * Returns the human-friendly formatted time string.
   * @param {integer} seconds
   */
  function getHumanFriendlyTime(targetTime, currentTime) {
    // Gets the current unixtime.
    currentTime = currentTime || parseInt(+new Date / 1000);
    var secondOffset = currentTime - targetTime;
    if (secondOffset < 5)
      return "now";
    else if (secondOffset < 60)
      return secondOffset + "s";
    else if (secondOffset < 60 * 60)
      return parseInt(secondOffset / 60) + "m";
    else if (secondOffset < 24 * 60 * 60)
      return parseInt(secondOffset / 60 / 60) + "h";
    return parseInt(secondOffset / 24 / 60 / 60) + "d";
  }
  /*
   * Interval of updating the formatted time string on each post.
   */
  var TIME_UPDATE_INTERVAL = 1000;

  $.escapeHTML = function(val) {
    return $("<div />").text(val).html();
  };

  var Class = function() {
    return function(){this.initialize.apply(this,arguments)}
  };

  var ChannelModel = function(channels) {
    this.array_ = channels;
  }
  ChannelModel.prototype = {
    array_: new Array(),
    get length() {
      return this.array_.length;
    },
    item: function(i) {
      return this.array_[i];
    },
    itemById: function(id) {
      for (var i = 0; i < this.array_.length; i++) {
          if (this.array_[i]['id'] == id)
          return this.array_[i];
      }
      console.exception();
    }

  };

  var TiarraMetroClass = new Class();

  TiarraMetroClass.prototype = {
    initialize: function( param ){
      var self = this;
      this.max_id = param.max_id;
      this.currentChannel = param.default_channel.id <0?null:param.default_channel.id;
      this.currentMenu = null;
      this.chLogs = param.chLogs;
      this.channels = new ChannelModel(param.channels);
      this.updating = param.updating;
      this.sending = false;
      this.jsConf = param.jsConf;
      this.mountPoint = param.mountPoint;
      this.variable = {};
      this.currentLog = {};
      this.addedLogCount = 0;
      this.unread_num = 0;
      this.history = { i:-1, log: new Array() };

      this.popup = $('#log_popup_menu');
      this.autoReload =  setInterval(function(){self.reload();}, this.jsConf["update_time"]*1000);
      this.htmlInitialize( param );

      this.keymappingInitialize( param.jsConf[ 'keymapping' ] );
    },

    htmlInitialize: function( param ){
      var self = this;

      /* チャンネルの選択 */
      for (var i = 0; i < this.channels.length; i++) {
        var ch = this.channels.item(i);
        ch['name'] = ch['name'].replace(/sex/, 'nyan');
        var is_visible = ch['view'] - 0;  // ch['view'] is String Object.
        this.addChannel(ch['id'], ch['name'], is_visible);
      }

      $("ul.channel_list").on("click", "li", function() {
        channel_id = this.id.substring(3);
        channel_name = self.getChannelName(channel_id);
        self.selectChannel(channel_id, channel_name);
        self.myPushState(channel_name,'/channel/'+channel_id);
      });

      /* 投稿 */
      $('form#post_form').submit(function(){
        message = $('input#message').val();
        if( message.length == 0 ){
          //空postで 更新取得中フラグを強制リセットさせてみる
          self.updating = false;
          return false;
        }

        $('input#message').attr('disabled','disabled');
        $('form#post_form input[type=submit]').attr('disabled','disabled');

        self.history.log.unshift( message );
        self.history.i = -1;

        $.ajax({
          url:self.mountPoint+'/api/post/',
          data:{
            channel_id:self.currentChannel,
            post:message,
            notice:$('input#notice').attr('checked') == 'checked',
          },
          dataType:'json',
          type:'POST',
          success:function(){
            $('input#message').removeAttr('disabled').removeClass('error');
            $('form#post_form input[type=submit]').removeAttr('disabled');
            $('input#message').val('');
            $('input#notice').removeAttr('checked');
          },
          error:function(){
            $('input#message').removeAttr('disabled').addClass('error');
            $('form#post_form input[type=submit]').removeAttr('disabled');
          },
        });
        return false;
      });
      
      /* クイック投稿 */
      $('form#quick_form').submit(function(){
        if( self.sending ){ return; }
        self.sending = true;
        var form = this;
        var post = $('input[name="post"]',form);
        message = post.val();
        if( message.length == 0 ){ return false; }

        post.attr('disabled','disabled');
        $('input[type=submit]',form).attr('disabled','disabled');
        $.ajax({
          url:self.mountPoint+'/api/post/',
          data:{
            channel_id:self.currentChannel,
            post:message,
            notice:false,
          },
          dataType:'json',
          type:'POST',
          success:function(){
            post.removeAttr('disabled').removeClass('error').val('');
            $('input[type=submit]',form).removeAttr('disabled');
            if( !('auto_close' in self.currentMenu) || self.currentMenu[ 'auto_close' ] ){
              self.popup.css('display','none');
            }
            self.sending = false;
          },
          error:function(){
            post.removeAttr('disabled').removeClass('error');
            $('input[type=submit]',form).removeAttr('disabled');
            self.sending = false;
          },
        });
        return false;
      });

      /* 検索 */
      $('form#search_form').submit(function(){
        kw = $('input#keyword').val();
        if( kw.length == 0 ){ return false; }

        $('#search-list').empty();
        $('div#search_foot').html( '<div id="spinner"><img src="images/spinner_b.gif" width="32" height="32" border="0" align="center" alt="searching..."></div>' );

        $('div.headers span.header[name=search]').text( 'search' );
        if (!self.isCurrentPivotByName("search")) {
          self.goToPivotByName("search");
        }

        d = { keyword:kw };
        select = $('select#channel_select option:selected').val();
        if( select.length ){
          d['channel_id'] = select;
        }

        $.ajax({
          url:self.mountPoint+'/api/search/',
          data:d,
          dataType:'json',
          type:'POST',
          success:function(json){
            $('#search_result_message').text('search result '+json.length);
            if( json.length ){
              $.each( json.reverse(), function(i,log){ self.add_result(i,log); } ); 
            }
            self.addCloseButton();

            self.afterAdded(null);
          }
        })
        return false;
      });
      
      /* 設定画面の表示 */
      $('input#setting_button').click(function(){
        $('div.headers span.header[name=setting]').text( 'setting' );
        if (!self.isCurrentPivotByName("setting")) {
          self.goToPivotByName("setting");
        }
      });
      /* 設定画面を閉じる */
      $('input#setting_close').click(function(){
        $('div.headers span.header[name=setting]').html( '' );
        if (!self.isCurrentPivotByName("list")) {
          self.goToPivotByName("list");
          self.onListInvisible();
        }
      });
      /* 設定のチャンネルリストの変更 */
      $('select#channel_setting_select').change( function(){
        channel_id = $('select#channel_setting_select option:selected').val();
        if( channel_id == '' ){ $('#channel_setting_elements').css('display','none'); }
        else{ $('#channel_setting_elements').css('display','block'); }

        setting = self.getChannelSettings( channel_id );
        
        if( setting.hasOwnProperty( 'on_icon' ) ){
          on_icon = setting['on_icon'];
        }else{
          on_icon = self.jsConf['on_icon'];
        }
        $('form#setting_form select[name=on_icon]').val( on_icon?'on':'off' );
        if( $('ul.channel_list li#ch_'+channel_id ).length ){
          view = true;
        }else{
          view = false;
        }
        $('form#setting_form select[name=view]').val( view?'on':'off' );

        $('form#setting_form select[name=new_check]').val( (setting.hasOwnProperty( 'new_check' )?setting['new_check']:true)?'on':'off'  );
        $('form#setting_form select[name=pickup_check]').val( (setting.hasOwnProperty( 'pickup_check' )?setting['new_check']:true)?'on':'off'  );
      });
      /* チャンネル設定の適用 */
      $('form#setting_form').submit( function(){
        var submit = $('input[type=submit]', this );
        submit.attr('disabled','disabled');

        channel_id = $('select#channel_setting_select option:selected').val();
        on_icon = $('form#setting_form select[name=on_icon] option:selected').val();
        if( on_icon == 'default' ){
          self.deleteChannelSetting( channel_id, 'on_icon' );
        }else{
          self.setChannelSetting( channel_id, 'on_icon', on_icon == 'on' );
        }
        self.setChannelSetting( channel_id, 'new_check', $('form#setting_form select[name=new_check] option:selected').val()=='on' );
        self.setChannelSetting( channel_id, 'pickup_check', $('form#setting_form select[name=pickup_check] option:selected').val()=='on' );

        $.ajax({
          url:self.mountPoint+'/api/setting/view/'+channel_id,
          dataType:'json',
          type:'POST',
          data:{
            value: $('form#setting_form select[name=view] option:selected').val()
          },
          success: function( data ){
            submit.removeAttr('disabled');
          }
        });

        return false;
      });
      /* localStrageのリセット*/
      $('input#setting_reset').click(function(){
        localStorage.clear();
      });

      /* 未読のリセット */
      $('input#unread_reset').click(function(){
        $.ajax({
          url:self.mountPoint+'/api/reset/unread',
          dataType:'json',
          type:'POST',
        });

        self.offListInvisible();

        $('.channel_list li').removeClass("new hit");
        $('.channel_list li span.ch_num').html('');
      });
      
      /* ログアウト */
      $('input#logout').click(function(){
        location.href = self.mountPoint+'/logout';
      });

      /* ブラウザの戻る、進むのフック */
      $(window).bind('popstate', function(event) {
        switch( event.originalEvent.state ){
          case '/':
            self.goToPivotByName("list");
            break;
          case '/search/':
            self.goToPivotByName("search");
            break;
          case '/setting/':
            self.goToPivotByName("setting");
            break;
          case null:
            break;
          default:
            channel_id = event.originalEvent.state.substring( event.originalEvent.state.lastIndexOf( '/' )+1 );
            channel_name = self.getChannelName(channel_id);
            self.selectChannel(channel_id,channel_name);
            break;
        }
      }, false);

      /* フリックによるヘッダー遷移 */
      $(document).touchwipe({
        preventDefaultEvents: false,
        min_move_x: 75,
        wipeLeft: function() { self.goToNextPivot(); },
        wipeRight: function() { self.goToPreviousPivot(); }
      });

      /* pivot化 */
      $(".metro-pivot").metroPivot({
        controlInitialized: function() {
          var metroPivot = $(this);
          var headers = metroPivot.find(".headers .header");

          /* ホビロン */
          metroPivot.find(".pivot-item").each(function(i, item) {
            self.getPivotHeaderByIndex(i).attr("name", $(item).attr("name"));
          });

          /* headers に背景色をもたせる */
          metroPivot.children(".headers").addClass("theme-bg");

          switch ( param.default_pivot ) {
            case 'channel':
              self.loadChannel( param.default_channel.id , param.default_channel.name);
            default:
              self.goToPivotByName(param.default_pivot);
              break;
            case 'list':
            case 'default':
              break;
            case 'search':
              //TODO: 検索の再現？
            case 'setting':
              $('div.headers span.header[name='+param.default_pivot +']').text( param.default_pivot );
              self.goToPivotByName(param.default_pivot);
              break;
          }

          // FIXME: 本来のクリック処理を外して別のイベントを挟んでから戻す */
          var newOnClick = $.proxy(self.onClickPivotHeader, self);
          var oldOnClick = $.proxy(self.getPivotController().pivotHeader_Click, self.getPivotController());
          headers
            .off("click")
            .on("click", function() { newOnClick($(this)); })
            .on("click", function() { oldOnClick($(this)); })
            ;
        },
        selectedItemChanged:function( index ){
          self.popup.css('display','none');
          self.updateStatusNotifier();

          switch (index) {
          case '0': //channel list
            self.myPushState( 'channel list','/' );
            self.onListInvisible();
            break;
          case '1':
            self.myPushState($('div.headers span.header[index=1]').text(),'/channel/'+self.currentChannel );
            break;
          case '2': //search
            self.myPushState('search','/search/' );
            break;
          case '3': //setting
            self.myPushState('setting','/setting/' );
            break;
          }
        }
      });

      $(".status-notifier").on("click", function(event) {
        var target = $(); // empty
        var classes = ["hit", "new"]
        for (i in classes) {
          target = $(".channel_list li.current ~ li."+classes[i]+":first");
          if (!target.length) target = $(".channel_list li."+classes[i]+":first");
          if (!!target.length) break;
        }

        if (!target.length && self.jsConf.patrol_channel ){
          current_channel_name = $('div.headers span.header[name=channel]').text();
          switch( typeof self.jsConf.patrol_channel ){
            case 'string':
              channel_name = self.jsConf.patrol_channel;
              break;
            case 'object':
              if( ( index = self.jsConf.patrol_channel.indexOf( current_channel_name ) ) != -1 && index < self.jsConf.patrol_channel.length-1 ){
                channel_name = self.jsConf.patrol_channel[index+1];
              }else{
                channel_name = self.jsConf.patrol_channel[0];
              }
              break;
            default:
              return;
          }
          if( current_channel_name != channel_name ){
            target = $(".channel_list li:contains('"+channel_name+"')");
          }
        }
        if (target.length) {
          target.click();
        }
        self.updateStatusNotifier();
      });

      setTimeout(this.updateTime.bind(this), TIME_UPDATE_INTERVAL);
      
      self.updateStatusNotifier();
    },  // tiarraMetroClass.htmlInitialize

    keymappingInitialize: function( keymapping ){
      var self = this;
      if( keymapping ){
        if( keymapping.hasOwnProperty( 'channel_list' ) ){
          target = $(".channel_list li:first").addClass( 'select' );
          $.each( keymapping[ 'channel_list' ] , function(key,val){
            switch(key){
              case 'up':
                $(document).bind('keydown', val, function(){ 
                  var current = $(".channel_list li.select");
                  prev = current;
                  while( prev.length ){
                    if( (p =prev.prev( ':visible' ).addClass( 'select' ) ).length ){
                      current.removeClass( 'select' );
                      self.viewScroll( p );
                      break;
                    }
                    prev = prev.prev();
                  }
                  if( !prev.length ){
                    if( ( prev = $(".channel_list li:visible:last").addClass( 'select' ) ).length ){
                      current.removeClass( 'select' );
                      self.viewScroll( prev );
                    }
                  }
                });
                break;
              case 'down':
                $(document).bind('keydown', val, function(){
                  var current = $(".channel_list li.select");

                  if( ! ( next = $(".channel_list li.select ~ li:visible:first") ).length ){
                    next = $(".channel_list li:visible:first");
                  }
                  
                  if( next.addClass( 'select' ).length ){
                    current.removeClass( 'select' );
                    self.viewScroll( next );
                  }
                });
                break;
              case 'open':
                $(document).bind('keydown', val, function(){
                  $(".channel_list li.select").click();
                });
                break;
              case 'channel_toggle':
                $(document).bind('keydown', val, function(){
                  $("ul.channel_list").toggleClass("invisible");
                });
                break;
            }
          });
        }
        if( keymapping.hasOwnProperty( 'pivot_controller' ) ){
          $.each( keymapping[ 'pivot_controller' ] , function(key,val){
            switch(key){
              case 'next':
                $(document).bind('keydown', val, function(){ self.goToNextPivot(); });
                break;
              case 'prev':
                $(document).bind('keydown', val, function(){ self.goToPreviousPivot(); });
                break;
              case 'close':
                $(document).bind('keydown', val, function(){
                  $('div.headers span.header[name=channel]').html( '' );
                  if (!self.isCurrentPivotByName("list")) {
                    self.goToPivotByName("list");
                    self.onListInvisible();
                  }
                });
                break;
            }
          });
        }
        if( keymapping.hasOwnProperty( 'action' ) ){
          $.each( keymapping[ 'action' ] , function(key,val){
            switch(key){
              case 'tour':
                $(document).bind('keydown', val, function(){ $(".status-notifier").click(); });
                break;
              case 'input_focus':
                $(document).bind('keydown', val, function(){ $('input#message').focus(); });
                break;
              case 'sample':
                $(document).bind('keydown', val, function(){  });
                break;
            }
          });
        }
        if( keymapping.hasOwnProperty( 'input_histry' ) && keymapping[ 'input_histry'] ){
          $('input#message').bind('keydown', 'up', function(){
            if( self.history.log.length > self.history.i+1){
              self.history.i++;
              $('input#message').val( self.history.log[ self.history.i ] );
            }
          });
          $('input#message').bind('keydown', 'down', function(){
            if( self.history.i > 0 ){
              self.history.i--;
              $('input#message').val( self.history.log[ self.history.i ] );
            }else{
              self.history.i = -1;
              $('input#message').val( '' );
            }
          });
        }
      }
    },
    onClickPivotHeader: function(header) {
      var self = this;

      if (header.hasClass("current")) {
        switch( header.attr("name") ){
          case "list":
            header.toggleClass('closed')
            $("ul.channel_list").toggleClass("invisible");
            break;
          case 'channel':
            on_icon = $('#list').hasClass( 'on_icon' );
            if( on_icon ){ 
              $('#list').removeClass( 'on_icon' );
            }else{
              $('#list').addClass( 'on_icon' );
            }
            self.setChannelSetting( self.currentChannel, 'on_icon', !on_icon );
            break;
        }
      }
    },
    reload: function(){
      var self = this;

      if( self.updating ){ return; }

      self.updating = true;

      $.ajax({
        url: self.mountPoint+'/api/logs/',
        dataType: 'json',
        type: 'POST',
        data: {
          max_id: self.max_id,
          current: self.isCurrentPivotByName("list") ? "" : self.currentChannel
        },
        success: function(json) {
          var clientTime = parseInt(+new Date / 1000);  // Gets unixtime.
          self.timeOffset_ = clientTime - json['unixtime'];

          if( json['update'] ){
            $.each( json['logs'], function(channel_id, logs){

              //新しいチャンネルの場合
              if (!$('#ch_' + channel_id).length)
                  this.addChannel(channel_id, null, true);

              /* 設定のロード */
              setting = self.getChannelSettings( channel_id );

              /* 重複チェック */
              logs = $.map( logs, function( log,i){
                if( self.currentLog.hasOwnProperty( log.id ) ){ return null; }
                self.currentLog[ log.id ] = log;
                return log;
              });
              if( !logs.length ){ return; }

              /* pickup word の検出とフラグの追加 */
              if( ( !('pickup_check' in setting) || setting['pickup_check'] ) && self.jsConf.pickup_word && self.jsConf.pickup_word.length ){
                $.each( logs, function( i,log){
                  if( log.is_notice != 1 && log.nick != self.jsConf.my_name ){
                    $.each( self.jsConf.pickup_word,function(j,w){
                      if( log.log.indexOf(w) >= 0 ){
                        $.jGrowl( log.nick+':'+ log.log +'('+self.getChannelName(channel_id)+')' ,{ header: 'keyword hit',life: 5000 } );
                        $('#ch_'+channel_id).addClass('hit');
                        logs[i].pickup = true;
                      }
                    });
                  }
                });
              }
              
              /* 内部的に保持するログを各チャンネル30に制限 */
              self.chLogs[channel_id] = logs.concat(self.chLogs[channel_id]).slice(0,30);

              if( !('new_check' in setting) || setting['new_check'] ){
                if( channel_id != self.currentChannel || self.isCurrentPivotByName("list") ){
                  $('#ch_'+channel_id).addClass('new');

                  num = $('#ch_'+channel_id+' span.ch_num');

                  currentNum = Number($('small',num).text())-0+logs.length;

                  if( currentNum > 0 ){
                    num.html( '<small>'+currentNum+'</small>' );
                  }
                }else{
                  $('#ch_'+channel_id).removeClass('hit new');
                }
              }

              var time_element = $('#time_ch_' + channel_id);
              if (time_element) {
                var current_last_update = parseInt(time_element.attr('time'));
                var new_time = logs[0]['time'];
                if (current_last_update < new_time)
                  time_element.attr('time', new_time);

                var ch_element = $('#ch_' + channel_id);

                ch_element.remove();
                $('ul.channel_list').prepend(ch_element);
              }

              /* 選択中のチャンネルの場合、domへの流し込みを行う */
              if( channel_id == self.currentChannel ){
                $.each( logs.reverse(), function(i,log){ self.add_log(i,log, -1); } );
                self.afterAdded(channel_id);
              }
            });
            self.max_id = json['max_id'];
          }
          self.updateStatusNotifier();
          self.updating = false;
        },
        error:function(){
          self.updating = false;
        }
      });   
    },

    /* log build */
    logFilter : function(log){
      var self = this;
      if( log.filtered ){ return log; }

      //log.log = $.escapeHTML( log.log );

      /* pickupタグの適用 */
      if( log.pickup ){
        $.each( self.jsConf.pickup_word,function(j,w){
          log.log = log.log.replace( w, '<strong class="highlight">'+w+'</strong>' );
        });
      }

      log.filtered = true;

      return log;
    },

    add_log:function( i, log, unread_point ){
      var self = this;
      var row = self.createRow(log);

      if( unread_point == i ){
        row.addClass( 'unread_border' );
      }
      $('#list').prepend(row);
    },
    more_log : function( i, log, unread_point ){
      var self = this;
      var row = self.createRow(log);

      if( unread_point == i ){
        row.addClass( 'unread_border' );
      }

      $('#list').append(row);
    },
    add_result : function( i, log ){
      $('#search-list').prepend(this.createRow(log,true));
    },
    afterAdded : function(channel_id){
      if(this.jsConf.on_image === 2 ) {
        $('#list a.boxviewimage').lightBox();
      }
    },
    createRow : function( log,searchFlag ){
      var self = this;

      log = self.logFilter(log);

      self.variable.alternate = !self.variable.alternate;
      var result =  '<div id="'+log.id+'" type="'+(log.is_notice == 1?'notice':'privmsg')+'" class="line text" nick="'+log.nick+'" alternate="'+(self.variable.alternate?'odd':'even')+'" highlight="'+(log.pickup?'true':'false')+'" >';
      searchFlag = (searchFlag==undefined?false:searchFlag);
      /* 検索の場合はチャンネルも記述する */
      if( searchFlag ){
        result += '<span class="channel">'+log.channel_name+'</span>';
      }
      var offset = self.timeOffset_ || 0;
      var unixtime = parseInt(log['time']) + offset;
      var time = getHumanFriendlyTime(unixtime);

      //time
      result += '<span class="time" time="' + unixtime + '">' + time + '</span>';

      //icon
      result += self.getIconString(log);

      //sender
      result += '<span class="sender" type="'+(log.nick==self.jsConf['my_name']?'myself':'normal')+'">'+log.nick+'</span>';

      //log
      result += '<span class="message" type="'+(log.is_notice == 1?'notice':'privmsg')+'">'+log.log+'</span>';
      //TODO: ここのtypeいんのか？

      //end
      result += '</div>';
      
      result = $(result);

      /* log popup menuの処理 */
      if( !searchFlag && self.currentMenu != null ){
        logElement = result;//$('span.message',result);
        if( !( 'match' in self.currentMenu) ||  logElement.text().match(new RegExp((self.currentMenu['match']) ) ) ){
          if( 'match' in self.currentMenu){
            var matchStr = RegExp.$1;
          }
          logElement.on( "click", function(event){
            event.stopPropagation();
            if( self.popup.css('display') == 'block' ){
              self.popup.css('display','none');
              return;
            }
            var ul = $('ul',self.popup);
            if( ul.children().length ){
              ul.empty();
            }
            $('form#quick_form input[name="post"]').val('' );
            if( 'menu' in self.currentMenu ){
              $.each( self.currentMenu['menu'], function(label,menu){
                var li = $('<li />').text(menu['label']?menu['label']:label);
                switch( menu['type'] ){
                  case 'typablemap':
                    li.on('click',function(event){
                      self.popup.css('display','none');
                      $.ajax({
                        url:self.mountPoint+'/api/post/',
                        data:{
                          channel_id:self.currentChannel,
                          post:label+' '+matchStr,
                          notice:false,
                        },
                        dataType:'json',
                        type:'POST',
                      });
                    });
                    break;
                  case 'typablemap_comment':
                    li.on('click',function(event){
                      ul.empty();
                      $('form#quick_form input[name="post"]').val(label+' '+matchStr+' ' ).focus();
                    });
                    break;
                  case 'action':
                    li.on('click',function(event){
                      switch( label ){
                        case 'close':
                          $('div.headers span.header[name=channel]').html( '' );
                        case 'list':
                          if (!self.isCurrentPivotByName("list")) {
                            self.goToPivotByName("list");
                            self.onListInvisible();
                          }
                          break;
                        case 'tour':
                          $(".status-notifier").click();
                          break;
                        case 'top':
                          $( window ).scrollTop(0);
                          self.popup.css('display','none');
                          break;
                        case 'post':
                          self.popup.css('display','none');
                          $.ajax({
                            url:self.mountPoint+'/api/post/',
                            data:{
                              channel_id:self.currentChannel,
                              post:menu['value'],
                              notice:false,
                            },
                            dataType:'json',
                            type:'POST',
                          });
                          break;
                      }
                    });
                    break;
                }
                ul.append( li );
              });
            }  
            self.popup.css('top', event.pageY).append(ul).css('display','block');
          } );
          //リンククリック時にメニューが出るのを阻止する。
          logElement.on( "click", 'a', function( event ){
            event.stopPropagation();
          });
        }
      }
      return result;
    },
    updateTime: function() {
      var currentTime = parseInt(+new Date / 1000);  // Gets the current unixtime.
      $("span.time").each(function(i, elem){
          var unixtime = parseInt(elem.getAttribute('time'));
          elem.textContent = getHumanFriendlyTime(unixtime, currentTime); });
      setTimeout(this.updateTime.bind(this), TIME_UPDATE_INTERVAL);
    },
    getIconString : function ( log ){
      nick = log.nick;
      if( this.jsConf['alias'] && nick in this.jsConf['alias'] ){ nick = this.jsConf['alias'][ nick ]; }
      
      var ret = '<img src="http://img.tweetimag.es/i/'+nick+'_n" alt="'+nick+'">';

      if( this.jsConf['on_twitter_link'] == 1 ){
        ret = '<a class="avatar" href="http://mobile.twitter.com/'+nick+'" target="_blank">'+ret+'</a>';
      }else{
        ret = '<span class="avatar" >' + ret + '</span>';
      }

      return ret;
    },
    getChannelName : function( i ){
      return $('li#ch_'+i+' span.ch_name').text();
    },

    myPushState : function( name, url ){
      if( history.pushState ){
        history.pushState( window.location.pathname ,name, this.mountPoint+url );
      }
    },
    selectChannel : function( channel_id, channel_name ){
      this.currentChannel = channel_id;

      $('.channel_list li').removeClass("current");
      $('#ch_'+channel_id).addClass("current");

      $("#list").empty();
      $("#ch_foot").empty();
      this.popup.css('display','none');

      this.currentLog = {};

      this.loadChannel(channel_id, channel_name);

      this.goToPivotByName("channel");
    },
    loadChannel : function( channel_id, channel_name ){
      var self = this;
      self.unread_num = $('#ch_'+channel_id+' span.ch_num small').text()-0;

      $('div.headers span.header[name=channel]').html( channel_name );
      $('#ch_'+channel_id).removeClass("new hit");
      $('#ch_'+channel_id+' span.ch_num').html('');

      channel_name.match( new RegExp( '(' + self.jsConf['log_popup_menu']['separator']+'\\w+)' ) );
      self.currentMenu = self.jsConf['log_popup_menu']['network'][ RegExp.$1 ]?self.jsConf['log_popup_menu']['network'][ RegExp.$1 ]:null;

      self.channel_setting = self.getChannelSettings( channel_id );
      if( ( ! ( 'on_icon' in self.channel_setting ) )?self.jsConf['on_icon']:self.channel_setting['on_icon'] ){ 
        $('#list').addClass( 'on_icon' );
      }else{
        $('#list').removeClass( 'on_icon' );
      }

      var logs = [].concat(self.chLogs[channel_id]).reverse();
      var unread_point = self.unread_num > 0 ? logs.length - self.unread_num: -1;
      $.each( logs , function(i,log){ self.add_log(i,log, unread_point); } );
      self.addedLogCount = logs.length;
      self.afterAdded( channel_id );

      $.ajax({
        url:self.mountPoint+'/api/read/'+channel_id,
        dataType:'json',
        type:'POST',
      });

      if( self.chLogs[channel_id].length >= 30 ){
        self.addMoreButton( );
      }
    },
    addMoreButton : function(){
      var self = this;
      button = $('<input type="button" value="more">');
      button.click(function(){
        $('div#ch_foot').html( '<div id="spinner"><img src="images/spinner_b.gif" width="32" height="32" border="0" align="center" alt="loading..."></div>' );

        $.ajax({
          url:self.mountPoint+'/api/logs/'+self.currentChannel,
          data:{
            prev_id: $('#list div.line').last().attr('id'),
          },
          dataType:'json',
          type:'POST',
          success:function(json){
            if( json['error'] ){ return; }

            $.each(json['logs'],function(i,log){ self.more_log(i, log, self.unread_num-self.addedLogCount); });
            self.addedLogCount += json['logs'].length;

            self.addMoreButton( );

            self.afterAdded(self.currentChannel);
          }
        });
      });
      $('div#ch_foot').html(button);
    },
    addCloseButton : function(){
      var self = this;
      button = $('<input type="button" value="close">');
      button.click(function(){
        $('div.headers span.header[name=search]').html( '' );
        if (!self.isCurrentPivotByName("list")) {
          self.goToPivotByName("list");
          self.onListInvisible();
        }
      });
      $('div#search_foot').html(button);
    },
    
    addChannel: function(channel_id, name, is_visible) {
      if ($('#ch_' + channel_id).length)
        return;

      var ch = this.channels.itemById(channel_id);
      var lastupdate = ch['lastupdate'];
      var time = getHumanFriendlyTime(lastupdate);

      var html = $(document.createElement('li'))
                     .attr('id', 'ch_' + channel_id);

      $(document.createElement('span'))
          .attr('class', 'ch_name')
          .text('new channel')
          .appendTo(html);

      $(document.createElement('span'))
          .attr('class', 'ch_num')
          .appendTo(html);

      $(document.createElement('span'))
          .attr('class', 'time')
          .attr('id', 'time_ch_' + channel_id)
          .attr('time', lastupdate)
          .text(time)
          .appendTo(html);

      $('ul.channel_list').prepend(html);

      if (is_visible) {
        $(document.createElement('option'))
          .attr('value', channel_id)
          .text(name)
          .appendTo('select#channel_select');
      }

      $(document.createElement('option'))
        .attr('value', channel_id)
        .text(name)
        .appendTo('select#channel_setting_select');

      if (name) {
        $('#ch_' + channel_id + ' span.ch_name').text(name);
      } else {
        $.ajax({
          url: this.mountPoint + '/api/channel/name/' + channel_id,
          dataType: 'json',
          type: 'POST',
          success: function(chData) {
              $('#ch_' + chData.id + ' span.ch_name').text(chData.name);
          },
        });
      }

      //todo: settingのチャンネル一覧に追加
    },

    onListInvisible: function(){
      if( $('ul.channel_list li.new').length || $('ul.channel_list li.hit').length ){
        $('div.headers span.header[name="list"]').addClass('closed');
        $('ul.channel_list').addClass('invisible');
      }else{
        $('div.headers span.header[name="list"]').removeClass('closed');
        $('ul.channel_list').removeClass('invisible');
      }
    },
    offListInvisible: function(){
      $('div.headers span.header[name="list"]').removeClass('closed');
      $('ul.channel_list').removeClass('invisible');
    },
    updateStatusNotifier: function() {
      $(".status-notifier")
        .toggleClass('new', !!$('.channel_list li.new').length)
        .toggleClass('hit', !!$('.channel_list li.hit').length)
        ;
    },
    viewScroll: function( elm ){
      var et = elm.offset().top;
      var eh = elm.height();
      var st = $(window).scrollTop();
      var wh = $(window).height();
      if ( st+wh < et+eh || st > et ) $("html,body").animate( {scrollTop:et-$('div.headers').height()},100);
    },
    /* local strage */
    getChannelSettings: function( channel_id ){
      channels = localStorage.getItem( 'channels' );
      if( channels == null ){ channels = {}; }
      else{ channels = JSON.parse( channels ); }
      if( !channels.hasOwnProperty(channel_id) ) { channels[ channel_id ] = {}; }

      localStorage.setItem( 'channels', JSON.stringify(channels) );
      return channels[ channel_id ];
    },
    getChannelSetting: function( channel_id, key ){
      channel = this.getChannelSettings( channel_id );
      if( channel == null ){ return null; }
      if( channel.hasOwnProperty(key) ) { return channel[ key ]; }
      return null;
    },
    setChannelSetting: function( channel_id, key, value ){
      channels = localStorage.getItem( 'channels' );
      if( channels == null ){ channels = {}; }
      else{ channels = JSON.parse( channels ); }
      if( !channels.hasOwnProperty(channel_id) ) { channels[ channel_id ] = {}; }
      channels[ channel_id ][ key ] = value;
      localStorage.setItem( 'channels', JSON.stringify(channels) );
    },

    /* Pivot helpers */
    getPivotController: function() {
      return $(".metro-pivot").data("controller");
    },
    getPivotHeaders: function() {
      return this.getPivotController().headers;
    },
    getPivotHeaderByName: function(name) {
      return this.getPivotHeaders().children(".header[name="+name+"]");
    },
    getPivotHeaderByIndex: function(index) {
      return this.getPivotHeaders().children(".header[index="+index+"]");
    },
    isCurrentPivotByName: function(name) {
      return this.getPivotHeaderByName(name).hasClass("current");
    },
    isCurrentPivotByIndex: function(index) {
      return this.getPivotHeaderByIndex(index).hasClass("current");
    },
    goToPivotByName: function(name) {
      this.getPivotController().pivotHeader_Click( this.getPivotHeaderByName(name) );
    },
    goToPivotByIndex: function(index) {
      this.getPivotController().pivotHeader_Click( this.getPivotHeaderByIndex(index) );
    },
    goToNextPivot: function(){
      var next = $(".metro-pivot .headers .header:gt(0):not(:empty):first");
      if (next.length) this.goToPivotByName(next.attr("name"));
    },
    goToPreviousPivot: function(){
      var prev = $(".metro-pivot .headers .header:not(:empty):last");
      if (prev.length) this.goToPivotByName(prev.attr("name"));
    }
  };

  window.TiarraMetroClass = TiarraMetroClass;
});
