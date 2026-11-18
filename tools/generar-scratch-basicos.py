#!/usr/bin/env python3
"""Genera las versiones básicas de los proyectos 5 a 8 de Scratch."""
import hashlib
import json
from pathlib import Path
import zipfile

from scratch_sb3 import Scripts, block, label, report, slot, svg, variable

OUT = Path(__file__).resolve().parents[1] / 'assets' / 'scratch'
SOLID = '#356485'
FLAG = block('event_whenflagclicked')
CLICK = block('event_whenthisspriteclicked')
CLONE = block('control_start_as_clone')
SHOW = block('looks_show')
HIDE = block('looks_hide')
DELETE_CLONE = block('control_delete_this_clone')
X = report(block('motion_xposition'))
Y = report(block('motion_yposition'))


def scripts(*stacks):
    result = Scripts()
    for index, stack in enumerate(stacks):
        result.chain(stack, position=(40 + 370 * index, 40))
    return result.blocks


def menu(opcode, key, menu_opcode, field, value):
    return block(opcode, {key: [1, block(menu_opcode, fields={field: [value, None]}, shadow=True)]})


def backdrop(name):
    return menu('looks_switchbackdropto', 'BACKDROP', 'looks_backdrops', 'BACKDROP', name)


def on_backdrop(name):
    return block('event_whenbackdropswitchesto', fields={'BACKDROP': [name, None]})


def key(name):
    return menu('sensing_keypressed', 'KEY_OPTION', 'sensing_keyoptions', 'KEY_OPTION', name)


def on_key(name):
    return block('event_whenkeypressed', fields={'KEY_OPTION': [name, None]})


def on_message(name):
    return block('event_whenbroadcastreceived', fields={'BROADCAST_OPTION': [name, name]})


def send(name, wait_for_scripts=False):
    opcode = 'event_broadcastandwait' if wait_for_scripts else 'event_broadcast'
    return block(opcode, {'BROADCAST_INPUT': [1, [11, name, name]]})


def stop():
    result = block('control_stop', fields={'STOP_OPTION': ['all', None]})
    result['mutation'] = {'tagName': 'mutation', 'children': [], 'hasnext': 'false'}
    return result


def wait(seconds):
    return block('control_wait', {'DURATION': slot(seconds)})


def wait_until(condition):
    return block('control_wait_until', {'CONDITION': [2, condition]})


def set_var(name, value):
    return block('data_setvariableto', {'VALUE': slot(value)}, {'VARIABLE': [name, name]})


def change_var(name, value):
    return block('data_changevariableby', {'VALUE': slot(value)}, {'VARIABLE': [name, name]})


def compare(op, left, right):
    return block('operator_' + op, {'OPERAND1': left, 'OPERAND2': right})


def both(left, right):
    return compare('and', [2, left], [2, right])


def negate(condition):
    return block('operator_not', {'OPERAND': [2, condition]})


def arithmetic(op, left, right):
    return report(block('operator_' + op, {'NUM1': left, 'NUM2': right}))


def when(condition, *body, otherwise=()):
    inputs = {'CONDITION': [2, condition], 'SUBSTACK': [2, body]}
    if otherwise:
        inputs['SUBSTACK2'] = [2, otherwise]
    return block('control_if_else' if otherwise else 'control_if', inputs)


def forever(*body):
    return block('control_forever', {'SUBSTACK': [2, body]})


def repeat(count, *body):
    return block('control_repeat', {'TIMES': count, 'SUBSTACK': [2, body]})


def until(condition, *body):
    return block('control_repeat_until', {'CONDITION': [2, condition], 'SUBSTACK': [2, body]})


def goto(x, y):
    return block('motion_gotoxy', {'X': slot(x), 'Y': slot(y)})


def change_x(amount):
    return block('motion_changexby', {'DX': amount})


def change_y(amount):
    return block('motion_changeyby', {'DY': amount})


def set_x(position):
    return block('motion_setx', {'X': slot(position)})


def touching(name):
    return menu('sensing_touchingobject', 'TOUCHINGOBJECTMENU',
                'sensing_touchingobjectmenu', 'TOUCHINGOBJECTMENU', name)


def clone_self():
    return menu('control_create_clone_of', 'CLONE_OPTION', 'control_create_clone_of_menu',
                'CLONE_OPTION', '_myself_')


def say(text):
    return block('looks_sayforsecs', {'MESSAGE': slot(text), 'SECS': slot(2.5)})


def rectangle(x, y, width, height, fill, radius=0):
    return (f'<rect x="{x}" y="{y}" width="{width}" height="{height}" '
            f'fill="{fill}" rx="{radius}"/>')


class Project:
    def __init__(self, slug):
        self.slug = slug
        self.assets = {}
        self.targets = []
        self.monitors = []

    def image(self, name, width, height, content):
        data = svg(width, height, content)
        asset_id = hashlib.md5(data).hexdigest()
        filename = f'{asset_id}.svg'
        self.assets[filename] = data
        return dict(name=name, assetId=asset_id, md5ext=filename, dataFormat='svg',
                    bitmapResolution=1, rotationCenterX=width / 2, rotationCenterY=height / 2)

    def background(self, name, color, content=''):
        return self.image(name, 480, 360, rectangle(0, 0, 480, 360, color) + content)

    def target(self, name, costumes, code, variables=None, lists=None, messages=()):
        stage = not self.targets
        result = dict(name=name, isStage=stage, costumes=costumes, sounds=[], blocks=code,
                      layerOrder=len(self.targets), variables={name: [name, value]
                                                             for name, value in (variables or {}).items()},
                      lists={name: [name, values] for name, values in (lists or {}).items()},
                      broadcasts={name: name for name in messages}, comments={},
                      currentCostume=0, volume=100)
        self.targets.append(result)
        return result

    def stage(self, backgrounds, code, **data):
        self.target('Stage', backgrounds, code, **data).update(
            tempo=60, videoTransparency=50, videoState='off', textToSpeechLanguage=None)

    def sprite(self, name, x, y, width, height, content, code, variables=None, visible=True):
        self.target(name, [self.image(name, width, height, content)], code, variables).update(
            x=x, y=y, visible=visible, size=100, direction=90,
            rotationStyle="don't rotate", draggable=False)

    def monitor(self, name, x=8, y=8, as_list=False):
        opcode = 'data_listcontents' if as_list else 'data_variable'
        self.monitors.append(dict(id=name, mode='list' if as_list else 'default', opcode=opcode,
                                  params={'LIST' if as_list else 'VARIABLE': name},
                                  spriteName=None, value=[] if as_list else 0,
                                  width=116 if as_list else 0, height=85 if as_list else 0,
                                  x=x, y=y, visible=True, sliderMin=0, sliderMax=100, isDiscrete=True))

    def write(self):
        directory = OUT / self.slug
        directory.mkdir(parents=True, exist_ok=True)
        project = dict(targets=self.targets, monitors=self.monitors, extensions=[],
                       meta=dict(semver='3.0.0', vm='2.3.0', agent='PIAR'))
        with zipfile.ZipFile(directory / f'{self.slug}-basico.sb3', 'w', zipfile.ZIP_DEFLATED) as archive:
            archive.writestr('project.json', json.dumps(project, ensure_ascii=False))
            for filename, data in self.assets.items():
                archive.writestr(filename, data)


def platforms():
    project = Project('plataformas')
    layouts = [
        [(0, 315, 480, 45), (145, 265, 105, 50), (320, 226, 125, 89)],
        [(0, 315, 480, 45), (105, 265, 110, 50), (272, 220, 110, 95), (384, 175, 86, 140)],
    ]
    backgrounds = [
        project.background(f'Nivel {index}', '#172c43',
                           label(240, 38, f'Nivel {index} · flechas y espacio', '#dbeafe', 21) +
                           ''.join(rectangle(*surface, SOLID) for surface in surfaces))
        for index, surfaces in enumerate(layouts, 1)
    ]
    backgrounds.append(project.background('Victoria', '#123d44',
                                         label(240, 95, '¡Llegaste a la última meta!', '#e4f8e4', 26)))
    current = report(block('looks_backdropnumbername', fields={'NUMBER_NAME': ['name', None]}))
    project.stage(backgrounds, scripts(
        (FLAG, backdrop('Nivel 1')),
        (on_message('siguiente_nivel'), when(compare('equals', current, slot('Nivel 1')),
                                             backdrop('Nivel 2'), wait(0.05),
                                             otherwise=(backdrop('Victoria'), stop()))),
    ), messages=['siguiente_nivel'])

    solid = block('sensing_touchingcolor', {'COLOR': [1, [9, SOLID]]})
    speed = variable('velocidad_Y')
    step = variable('paso_Y')
    pressed = key('space')
    motion = []
    for arrow, amount in [('left arrow', -4), ('right arrow', 4)]:
        motion.append(when(key(arrow), change_x(slot(amount)), when(solid, change_x(slot(-amount)))))
    motion.extend([
        change_y(slot(-1)), set_var('apoyado', 0),
        when(solid, set_var('apoyado', 1)), change_y(slot(1)),
        when(both(compare('equals', variable('apoyado'), slot(1)),
                  both(pressed, compare('equals', variable('espacio_antes'), slot(0)))),
             set_var('velocidad_Y', 12)),
        set_var('espacio_antes', 0), when(pressed, set_var('espacio_antes', 1)),
        change_var('velocidad_Y', -1),
    ])
    mutation = dict(tagName='mutation', children=[], proccode='mover en Y', argumentids='[]', warp='true')
    call = block('procedures_call')
    call['mutation'] = mutation
    prototype = block('procedures_prototype', shadow=True)
    prototype['mutation'] = {**mutation, 'argumentnames': '[]', 'argumentdefaults': '[]'}
    procedure = block('procedures_definition', {'custom_block': [1, prototype]})
    motion.extend([call, when(touching('Portal'), send('siguiente_nivel', True))])
    magnitude = report(block('operator_mathop', {'NUM': speed}, {'OPERATOR': ['abs', None]}))
    initial = (goto(-205, -118), set_var('velocidad_Y', 0), set_var('espacio_antes', 0), SHOW)
    project.sprite('Personaje', -205, -118, 24, 28,
                   rectangle(0, 0, 24, 28, '#5eead4', 5) + rectangle(16, 6, 4, 4, '#164e56', 1),
                   scripts(
                       (FLAG, *initial, forever(*motion)),
                       (on_backdrop('Nivel 2'), *initial),
                       (procedure, when(compare('lt', speed, slot(-12)), set_var('velocidad_Y', -12)),
                        set_var('paso_Y', 1),
                        when(compare('lt', speed, slot(0)), set_var('paso_Y', -1)),
                        repeat(magnitude,
                               when(negate(compare('equals', speed, slot(0))),
                                    change_y(step),
                                    when(solid, change_y(arithmetic('subtract', slot(0), step)),
                                         set_var('velocidad_Y', 0))))),
                   ), variables={'velocidad_Y': 0, 'paso_Y': 1, 'apoyado': 0, 'espacio_antes': 0})
    project.sprite('Portal', 180, -25, 28, 42,
                   rectangle(0, 0, 28, 42, '#86efac', 8) + rectangle(6, 6, 16, 36, '#187456', 4),
                   scripts((FLAG, goto(180, -25), SHOW), (on_backdrop('Nivel 2'), goto(205, 26))))
    return project


def shooter():
    project = Project('shooter-espacial')
    stars = ''.join(rectangle((index * 173) % 480, (index * 97) % 360, 2, 2, '#8599c5')
                    for index in range(46))
    project.stage([
        project.background('Juego', '#10182e', stars + rectangle(0, 310, 480, 2, '#45678c')),
        project.background('Victoria', '#15393d', label(240, 88, '¡Oleada despejada!', '#d1fae5', 28)),
        project.background('Derrota', '#39223c', label(240, 88, 'Una nave llegó a la línea', '#ffe4e6', 24)),
    ], scripts(
        (FLAG, backdrop('Juego'), set_var('Derribos', 0), send('preparar_oleada'),
         wait_until(compare('equals', variable('Derribos'), slot(6))), backdrop('Victoria'), stop()),
        (on_message('derrota'), backdrop('Derrota'), stop()),
    ), variables={'Derribos': 0}, messages=['preparar_oleada', 'derrota'])
    ship = '<path d="M16 0L32 21H0Z" fill="#5eead4"/>' + rectangle(13, 10, 6, 5, '#155263', 2)
    project.sprite('Nave', 0, -140, 32, 22, ship, scripts(
        (FLAG, goto(0, -140), SHOW, forever(
            when(key('left arrow'), change_x(slot(-5))),
            when(key('right arrow'), change_x(slot(5))),
            when(compare('lt', X, slot(-220)), set_x(-220)),
            when(compare('gt', X, slot(220)), set_x(220)),
        )),
    ))
    enemy = rectangle(1, 1, 30, 20, '#ad8cf5', 8) + rectangle(7, 9, 18, 5, '#362359', 3)
    project.sprite('Enemigo', -110, 125, 32, 22, enemy, scripts(
        (on_message('preparar_oleada'), HIDE, goto(-110, 125),
         repeat(slot(2), set_x(-110),
                repeat(slot(3), clone_self(), change_x(slot(90))), change_y(slot(-45)))),
        (CLONE, SHOW, forever(
            change_y(slot(-0.5)),
            when(touching('Láser'), change_var('Derribos', 1), DELETE_CLONE),
            when(compare('lt', Y, slot(-120)), send('derrota'), DELETE_CLONE),
        )),
    ), visible=False)
    project.sprite('Láser', 0, -126, 5, 12, rectangle(0, 0, 5, 12, '#fef08a', 2), scripts(
        (FLAG, HIDE, forever(when(key('space'), clone_self(), wait(0.2)))),
        (CLONE, menu('motion_goto', 'TO', 'motion_goto_menu', 'TO', 'Nave'),
         change_y(slot(14)), SHOW,
         until(compare('gt', Y, slot(167)), change_y(slot(8))), DELETE_CLONE),
    ), visible=False)
    project.monitor('Derribos')
    return project


def runner():
    project = Project('endless-runner')
    ground = rectangle(0, 315, 480, 45, '#253c46') + rectangle(0, 315, 480, 3, '#b2d8cf')
    distance = variable('Distancia')
    speed = variable('Velocidad')
    reached_interval = compare('equals', arithmetic('mod', distance, slot(10)), slot(0))
    project.stage([
        project.background('Pista', '#213843', ground + label(240, 62, 'Espacio para saltar', '#d8f6ef', 21)),
        project.background('Fin', '#412939', ground + label(240, 90, 'Choque · vuelve a intentarlo', '#ffe4e6', 25)),
    ], scripts(
        (FLAG, backdrop('Pista'), set_var('Distancia', 0), set_var('Velocidad', 4), send('correr'),
         forever(wait(0.5), change_var('Distancia', 1),
                 when(both(reached_interval, compare('lt', speed, slot(9))), change_var('Velocidad', 1)))),
        (on_message('choque'), backdrop('Fin'), stop()),
    ), variables={'Distancia': 0, 'Velocidad': 4}, messages=['correr', 'choque'])
    vertical = variable('velocidad_Y')
    project.sprite('Corredor', -140, -120, 26, 30,
                   rectangle(0, 0, 26, 30, '#5eead4', 6) + rectangle(17, 6, 4, 4, '#174e58', 1),
                   scripts(
                       (FLAG, goto(-140, -120), set_var('velocidad_Y', 0), SHOW, forever(
                           change_y(vertical), change_var('velocidad_Y', -1),
                           when(compare('lt', Y, slot(-120)),
                                block('motion_sety', {'Y': slot(-120)}), set_var('velocidad_Y', 0)),
                       )),
                       (on_key('space'), when(compare('equals', Y, slot(-120)), set_var('velocidad_Y', 13))),
                   ), variables={'velocidad_Y': 0})
    random = report(block('operator_random', {'FROM': slot(9), 'TO': slot(17)}))
    random_wait = block('control_wait', {'DURATION': arithmetic('divide', random, slot(10))})
    project.sprite('Obstáculo', 225, -122, 26, 26, rectangle(0, 0, 26, 26, '#fbad81', 4), scripts(
        (on_message('correr'), HIDE, forever(random_wait, clone_self())),
        (CLONE, goto(225, -122), SHOW, until(
            compare('lt', X, slot(-220)),
            change_x(arithmetic('subtract', slot(0), speed)),
            when(touching('Corredor'), send('choque', True)),
        ), DELETE_CLONE),
    ), visible=False)
    project.monitor('Distancia')
    return project


def escape_room():
    project = Project('escape-room')
    project.stage([
        project.background('Habitación', '#292340',
                           rectangle(0, 253, 480, 107, '#3d3151') +
                           label(250, 54, 'Encuentra la salida', '#f0dcff', 24)),
        project.background('Salida', '#16423d',
                           label(240, 155, '¡Puerta abierta!', '#e5fff0', 31) +
                           label(240, 191, 'Has escapado.', '#cdf1e0', 20)),
    ], scripts(
        (FLAG, backdrop('Habitación'), block('data_deletealloflist', fields={'LIST': ['Inventario', 'Inventario']})),
        (on_message('escapar'), backdrop('Salida')),
    ), lists={'Inventario': []}, messages=['escapar'])
    reset = (FLAG, SHOW)
    finish = (on_message('escapar'), HIDE)
    project.sprite('Llave', -94, -33, 80, 71,
                   rectangle(0, 0, 80, 71, '#3b3057', 8) +
                   '<circle cx="29" cy="26" r="9" fill="none" stroke="#fcd879" stroke-width="5"/>' +
                   '<path d="M37 26H61V32H55V26" fill="none" stroke="#fcd879" stroke-width="5"/>' +
                   label(40, 59, 'Llave', '#fff', 14),
                   scripts(reset, (CLICK, block('data_addtolist', {'ITEM': slot('llave')},
                                                {'LIST': ['Inventario', 'Inventario']}), HIDE), finish))
    project.sprite('Nota', 4, -33, 80, 71,
                   rectangle(0, 0, 80, 71, '#3b3057', 8) + rectangle(28, 10, 24, 31, '#f7dfb3', 4) +
                   rectangle(33, 20, 14, 2, '#846a59') + rectangle(33, 26, 14, 2, '#846a59') +
                   label(40, 59, 'Nota', '#fff', 14),
                   scripts(reset, (CLICK, say('Dos círculos, tres triángulos, un cuadrado. Escribe las cantidades en ese orden.')), finish))
    has_key = block('data_listcontainsitem', {'ITEM': slot('llave')}, {'LIST': ['Inventario', 'Inventario']})
    answer = report(block('sensing_answer'))
    ready = compare('equals', variable('Consultando'), slot(0))
    project.sprite('Puerta', 129, -37, 84, 142,
                   rectangle(0, 0, 84, 142, '#564563', 12) +
                   rectangle(7, 7, 70, 128, '#815b75', 8) +
                   '<circle cx="61" cy="85" r="5" fill="#fcd879"/>' + label(42, 119, 'Puerta', '#fff', 15),
                   scripts(
                       (FLAG, set_var('Consultando', 0), SHOW),
                       (CLICK, when(ready, when(has_key,
                            set_var('Consultando', 1),
                            block('sensing_askandwait', {'QUESTION': slot('¿Cuál es el código de tres cifras?')}),
                            when(compare('equals', answer, slot('231')), send('escapar'),
                                 otherwise=(say('Revisa la pista e inténtalo de nuevo.'), set_var('Consultando', 0))),
                            otherwise=(say('Necesitas una llave.'),)))),
                       finish,
                   ), variables={'Consultando': 0})
    project.monitor('Inventario', as_list=True)
    return project


if __name__ == '__main__':
    for make_project in (platforms, shooter, runner, escape_room):
        make_project().write()
