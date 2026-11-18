"""Bloques y recursos vectoriales compartidos por los generadores de Scratch."""


def block(opcode, inputs=None, fields=None, shadow=False):
    return dict(opcode=opcode, inputs=inputs or {}, fields=fields or {}, shadow=shadow)


class Scripts:
    def __init__(self):
        self.blocks = {}

    def add(self, spec, parent=None, position=None):
        bid = f'b{len(self.blocks)}'
        entry = self.blocks[bid] = {
            **spec, 'parent': parent, 'next': None, 'topLevel': position is not None,
            'inputs': {},
        }
        if position is not None:
            entry['x'], entry['y'] = position
        for name, (mode, value, *fallback) in spec['inputs'].items():
            if isinstance(value, dict):
                value = self.add(value, bid)
            elif isinstance(value, tuple):
                value = self.chain(value, bid)
            entry['inputs'][name] = [mode, value, *fallback]
        return bid

    def chain(self, specs, parent=None, position=None):
        first = self.add(specs[0], parent, position)
        previous = first
        for spec in specs[1:]:
            current = self.add(spec, previous)
            self.blocks[previous]['next'] = current
            previous = current
        return first


def slot(value):
    primitive = [4 if isinstance(value, (int, float)) else 10, str(value)]
    return [1, primitive]


def variable(name):
    return [3, [12, name, name], [10, '']]


def report(spec):
    return [3, spec, [10, '']]


def svg(width, height, content):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}">{content}</svg>'.encode()


def label(x, y, text, color, size):
    return (f'<text x="{x}" y="{y}" text-anchor="middle" font-family="sans-serif" '
            f'font-size="{size}" font-weight="bold" fill="{color}">{text}</text>')
