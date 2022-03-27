var dust = /** @class */ (function () {
    function dust() {
        this.x = 50;
        this.y = 50;
        this.vx = Math.random() * 2 + 2;
        this.vy = Math.random() * 2;
        this.color = '#fff';
        this.shadowBlur = Math.random() * 3;
        this.shadowX = (Math.random() * 2) - 1;
        this.shadowY = (Math.random() * 2) - 1;
        this.radiusX = Math.random() * 3;
        this.radiusY = Math.random() * 3;
        this.rotation = Math.PI * Math.floor(Math.random() * 2);
    }
    return dust;
}());
var canvasDust = /** @class */ (function () {
    function canvasDust(canvasID) {
        var _this = this;
        this.width = 300;
        this.height = 300;
        this.dustQuantity = 50;
        this.dustArr = [];
        var canvas = document.getElementById(canvasID);
        if (canvas) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.build();
            window.addEventListener('resize', function () { return _this.resize(); });
        }
        else {
            throw new Error('canvasID 无效');
        }
    }
    canvasDust.prototype.build = function () {
        var _this = this;
        this.resize();
        if (this.ctx) {
            var point = canvasDust.getPoint(this.dustQuantity);
            for (var _i = 0, point_1 = point; _i < point_1.length; _i++) {
                var i = point_1[_i];
                var dustObj = new dust();
                this.buildDust(i[0], i[1], dustObj);
                this.dustArr.push(dustObj);
            }
            setInterval(function () {
                _this.play();
            }, 40);
        }
    };
    canvasDust.prototype.play = function () {
        var _a;
        var dustArr = this.dustArr;
        (_a = this.ctx) === null || _a === void 0 ? void 0 : _a.clearRect(0, 0, this.width, this.height);
        for (var _i = 0, dustArr_1 = dustArr; _i < dustArr_1.length; _i++) {
            var i = dustArr_1[_i];
            if (i.x < 0 || i.y < 0) {
                var x = this.width;
                var y = Math.floor(Math.random() * window.innerHeight);
                i.x = x;
                i.y = y;
                this.buildDust(x, y, i);
            }
            else {
                var x = i.x - i.vx;
                var y = i.y - i.vy;
                this.buildDust(x, y, i);
            }
        }
    };
    canvasDust.prototype.buildDust = function (x, y, dust) {
        var ctx = this.ctx;
        if (x)
            dust.x = x;
        if (y)
            dust.y = y;
        if (ctx) {
            ctx.beginPath();
            ctx.shadowBlur = dust.shadowBlur;
            ctx.shadowColor = dust.color;
            ctx.shadowOffsetX = dust.shadowX;
            ctx.shadowOffsetY = dust.shadowY;
            ctx.ellipse(dust.x, dust.y, dust.radiusX, dust.radiusY, dust.rotation, 0, Math.PI * 2);
            ctx.closePath();
            ctx.fillStyle = dust.color;
            ctx.fill();
        }
    };
    canvasDust.prototype.resize = function () {
        var canvas = this.canvas;
        var width = window.innerWidth;
        var height = window.innerHeight;
        this.width = width;
        this.height = height;
        this.dustQuantity = Math.floor((width + height) / 38);
        if (canvas !== undefined) {
            canvas.width = width;
            canvas.height = height;
        }
    };
    canvasDust.getPoint = function (number) {
        if (number === void 0) { number = 1; }
        var point = [];
        for (var i = 0; i < number; i++) {
            var x = Math.floor(Math.random() * window.innerWidth);
            var y = Math.floor(Math.random() * window.innerHeight);
            point.push([x, y]);
        }
        return point;
    };
    return canvasDust;
}());
var indexs = /** @class */ (function () {
    function indexs() {
        var _this = this;
        this.tocLink = document.querySelectorAll('.toc-link');
        this.index = [];
        this.totop = document.querySelector('#to-top');
        this.scrollID = null;
        this.scrolling = 0;
        if (this.tocLink.length > 0) {
            this.setItem(this.tocLink.item(0));
        }
        document.addEventListener('scroll', function () {
            _this.tocLink = document.querySelectorAll('.toc-link');
            if (_this.tocLink.length > 0) {
                _this.headerLink = document.querySelectorAll('.headerlink');
                _this.postContent = document.querySelector('#post-content');
                var totop = document.querySelector('#to-top');
                ++_this.scrolling;
                if (_this.scrollID == null && _this.tocLink.length > 0) {
                    _this.scrollID = setInterval(_this.modifyIndex.bind(_this), 50);
                }
                setTimeout(function () {
                    if (--_this.scrolling == 0) {
                        clearInterval(_this.scrollID);
                        _this.scrollID = null;
                        var totop_1 = document.querySelector('#to-top');
                        if (_this.totop !== null
                            && document.querySelector('#post-title').getBoundingClientRect().top < -200) {
                            totop_1.style.display = '';
                            setTimeout(function () { return totop_1.style.opacity = '1'; }, 300);
                        }
                        else {
                            totop_1.style.opacity = '0';
                            setTimeout(function () { return totop_1.style.display = 'none'; }, 300);
                        }
                    }
                }, 200);
            }
        }, { passive: true });
    }
    indexs.prototype.setItem = function (item) {
        item.classList.add('active');
        var $parent = item.parentElement, brother = $parent.children;
        for (var i = 0; i < brother.length; i++) {
            var item_1 = brother.item(i);
            if (item_1.classList.contains('toc-child')) {
                item_1.classList.add('has-active');
                break;
            }
        }
        for (var $parent_1 = item.parentElement; $parent_1.classList[0] != 'toc'; $parent_1 = $parent_1.parentElement) {
            if ($parent_1.classList[0] == 'toc-child') {
                $parent_1.classList.add('has-active');
            }
        }
    };
    indexs.prototype.reset = function () {
        var tocs = document.querySelectorAll('#toc-div .active');
        var tocTree = document.querySelectorAll('#toc-div .has-active');
        tocs.forEach(function (item) {
            item.classList.remove('active');
        });
        tocTree.forEach(function (item) {
            item.classList.remove('has-active');
        });
    };
    indexs.prototype.modifyIndex = function () {
        var _this = this;
        this.headerLink.forEach(function (item) {
            _this.index.push(item.getBoundingClientRect().top);
        });
        this.reset();
        for (var i = 0; i < this.tocLink.length; ++i) {
            var item = this.tocLink.item(i);
            if (i + 1 == this.index.length || (this.index[i + 1] > 150 && (this.index[i] <= 150 || i == 0))) {
                this.setItem(item);
                break;
            }
        }
        this.index = [];
    };
    indexs.prototype.scrolltop = function () {
        var _this = this;
        window.scroll({ top: 0, left: 0, behavior: 'smooth' });
        document.querySelector('#to-top').style.opacity = '0';
        setTimeout(function () { return _this.totop.style.display = 'none'; }, 300);
    };
    return indexs;
}());
var codes = /** @class */ (function () {
    function codes() {
    }
    codes.prototype.reverse = function (item, s0, s1) {
        var block = item.parentElement;
        if (block.classList.contains(s0)) {
            block.classList.remove(s0);
            block.classList.add(s1);
        }
        else {
            block.classList.remove(s1);
            block.classList.add(s0);
        }
    };
    codes.prototype.doAsMermaid = function (item) {
        var Amermaid = item.querySelector('.mermaid');
        item.outerHTML = '<div class="highlight mermaid">' + Amermaid.innerText + '</div>';
    };
    codes.prototype.resetName = function (str) {
        if (str == 'plaintext')
            return 'TEXT';
        if (str == 'cs')
            return 'C#';
        return str.toUpperCase();
    };
    codes.prototype.doAsCode = function (item) {
        var _this = this;
        var codeType = item.classList[1], lineCount = item.querySelector('.gutter').children[0].childElementCount >> 1;
        item.classList.add(lineCount < 16 ? 'open' : 'fold');
        item.innerHTML =
            '<span class="code-header"><span class="code-title">\
        <div class="code-icon"></div>' +
                this.resetName(codeType) + ' 共 ' + lineCount + ' 行</span>\
        <span class="code-header-tail">\
          <button class="code-copy"></button>\
          <span class="code-space">展开</span>\
        </span>\
    </span></span>\
    <div class="code-box">' + item.innerHTML + '</div>';
        item.querySelector('.code-copy').addEventListener('click', function (click) {
            var button = click.target;
            navigator.clipboard.writeText(item.querySelector('code').innerText);
            button.classList.add('copied');
            setTimeout(function () { return button.classList.remove('copied'); }, 1200);
        });
        item.querySelector('.code-header').addEventListener('click', function (click) {
            if (!click.target.classList.contains('code-copy')) {
                _this.reverse(click.currentTarget, 'open', 'fold');
            }
        });
    };
    codes.prototype.findCode = function () {
        var _this = this;
        var codeBlocks = document.querySelectorAll('.highlight');
        if (codeBlocks !== null) {
            codeBlocks.forEach(function (item) {
                if (!item.classList.contains('mermaid') && item.querySelector('.code-header') === null) {
                    if (item.querySelector('.mermaid') !== null) {
                        _this.doAsMermaid(item);
                    }
                    else {
                        _this.doAsCode(item);
                    }
                }
            });
        }
    };
    return codes;
}());
var cursors = /** @class */ (function () {
    function cursors() {
        var _this = this;
        this.first = true;
        this.outer = document.getElementById('cursor-outer').style;
        this.effecter = document.getElementById('cursor-effect').style;
        this.scale = 0;
        this.opacity = 0;
        this.last = 0;
        this.moveIng = false;
        this.fadeIng = false;
        this.attention = "a,input,button,.admonition,.code-header,.gt-user-inner,.gt-header-textarea,.navBtnIcon";
        this.effecter.transform = 'translate(-50%, -50%) scale(0)';
        this.effecter.opacity = '1';
        window.addEventListener('mousemove', function (mouse) { return _this.reset(mouse); }, { passive: true });
        window.addEventListener('click', function (mouse) { return _this.Aeffect(mouse); }, { passive: true });
        this.pushHolders();
        var observer = new MutationObserver(this.pushHolders.bind(this));
        observer.observe(document, { childList: true, subtree: true });
    }
    cursors.prototype.move = function (timestamp) {
        if (this.now !== undefined) {
            var SX = this.outer.left, SY = this.outer.top;
            var preX = Number(SX.substring(0, SX.length - 2)), preY = Number(SY.substring(0, SY.length - 2));
            var delX = (this.now.x - preX) * 0.3, delY = (this.now.y - preY) * 0.3;
            preX += delX;
            preY += delY;
            this.outer.left = preX.toFixed(2) + 'px';
            this.outer.top = preY.toFixed(2) + 'px';
            if (Math.abs(delX) > 0.2 || Math.abs(delY) > 0.2) {
                while (timestamp - this.last < 10)
                    this.last = timestamp;
                window.requestAnimationFrame(this.move.bind(this));
            }
            else {
                this.moveIng = false;
            }
        }
    };
    cursors.prototype.reset = function (mouse) {
        if (!this.moveIng) {
            this.moveIng = true;
            window.requestAnimationFrame(this.move.bind(this));
        }
        this.now = mouse;
        if (this.first) {
            this.first = false;
            this.outer.left = String(this.now.x) + 'px';
            this.outer.top = String(this.now.y) + 'px';
        }
    };
    cursors.prototype.Aeffect = function (mouse) {
        var _this = this;
        if (this.fadeIng == false) {
            var a = this;
            this.fadeIng = true;
            this.effecter.left = String(mouse.x) + 'px';
            this.effecter.top = String(mouse.y) + 'px';
            this.effecter.transition = 'transform .5s cubic-bezier(0.22, 0.61, 0.21, 1), opacity .5s cubic-bezier(0.22, 0.61, 0.21, 1)';
            this.effecter.transform = 'translate(-50%, -50%) scale(1)';
            this.effecter.opacity = '0';
            setTimeout(function () {
                _this.fadeIng = false;
                _this.effecter.transition = '';
                _this.effecter.transform = 'translate(-50%, -50%) scale(0)';
                _this.effecter.opacity = '1';
            }, 500);
        }
    };
    cursors.prototype.hold = function () {
        this.outer.height = '24px';
        this.outer.width = '24px';
        this.outer.background = "rgba(255, 255, 255, 0.5)";
    };
    cursors.prototype.relax = function () {
        this.outer.height = '36px';
        this.outer.width = '36px';
        this.outer.background = "unset";
    };
    cursors.prototype.pushHolder = function (items) {
        var _this = this;
        items.forEach(function (item) {
            if (!item.classList.contains('is--active')) {
                item.addEventListener('mouseover', function () { return _this.hold(); }, { passive: true });
                item.addEventListener('mouseout', function () { return _this.relax(); }, { passive: true });
            }
        });
    };
    cursors.prototype.pushHolders = function () {
        this.pushHolder(document.querySelectorAll(this.attention));
    };
    return cursors;
}());
var slides = /** @class */ (function () {
    function slides() {
        var _this = this;
        this.nav = document.querySelector('nav');
        this.button = this.nav.querySelector('.navBtnIcon');
        this.closeSearch = false;
        this.button.addEventListener('mousedown', function () {
            if (document.querySelector('.search')) {
                _this.closeSearch = true;
            }
        });
        this.button.onclick = function () {
            if (_this.closeSearch) {
                _this.closeSearch = false;
            }
            else if (_this.nav.classList[0] === 'expanded') {
                _this.nav.classList.remove('expanded');
            }
            else {
                _this.nav.classList.add('expanded');
            }
        };
        document.addEventListener('pjax:success', this.relabel);
        window.onload = this.relabel.bind(this);
    }
    slides.prototype.relabel = function () {
        if (this.nav === undefined) {
            this.nav = document.querySelector('nav');
        }
        var navs = this.nav.querySelectorAll('.navItem'), mayLen = 0, may;
        navs.forEach(function (item) {
            var now = item, link = now.querySelector('a');
            if (link !== null) {
                var href = link.href;
                now.classList.remove('active');
                if (href.length > mayLen && document.URL.match(href) !== null) {
                    mayLen = href.length;
                    may = now;
                }
            }
        });
        if (may !== null) {
            may.classList.add('active');
        }
    };
    return slides;
}());
var index = new indexs();
var code = new codes();
var cursor = new cursors();
new slides();
new canvasDust('canvas-dust');
