this.addEventListener('click', function(e) {
    if ((e.button === 0) && (e.shiftKey === false))
    {
        self.port.emit('left-click');
    }

    if ( (e.button === 2) ||
        ((e.button === 0) && (e.shiftKey === true)) )
    {
        self.port.emit('right-click');
        e.preventDefault();
    }
}, true);
