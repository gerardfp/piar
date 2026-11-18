#!/usr/bin/env python3
"""Genera la plantilla y la solución de Código de colores desde la raíz del portal."""
import hashlib
import io
import json
import math
from pathlib import Path
import struct
import wave
import zipfile

from scratch_sb3 import Scripts, block, label, report, slot, svg, variable

OUT = Path(__file__).resolve().parents[1] / 'assets/scratch/codigo-colores'
COLORS = [
    ('rojo', '#a32132', '#fda4af', 262),
    ('azul', '#1e47a0', '#93c5fd', 330),
    ('verde', '#16603f', '#86efac', 392),
    ('amarillo', '#795302', '#fde68a', 523),
]
BACKDROPS = ['Pulsa la bandera verde', 'Observa la secuencia', 'Tu turno', 'Fin · pulsa la bandera verde']
VALUES = {'Turno': 0, 'Posición': 1, 'Pulsación': '', 'Rondas': 0}
LISTS = {'Colores': [color[0] for color in COLORS], 'Secuencia': []}


def set_var(name, value):
    return block('data_setvariableto', {'VALUE': value}, {'VARIABLE': [name, name]})


def increment(name):
    return block('data_changevariableby', {'VALUE': slot(1)}, {'VARIABLE': [name, name]})


def item(name, index):
    return block('data_itemoflist', {'INDEX': index}, {'LIST': [name, name]})


def length():
    return report(block('data_lengthoflist', fields={'LIST': ['Secuencia', 'Secuencia']}))


def equals(left, right):
    return block('operator_equals', {'OPERAND1': left, 'OPERAND2': right})


def repeat(body):
    return block('control_repeat', {'TIMES': length(), 'SUBSTACK': [2, body]})


def wait(seconds):
    return block('control_wait', {'DURATION': slot(seconds)})


def switch(opcode, key, menu, field, name):
    return block(opcode, {key: [1, block(menu, fields={field: [name, None]}, shadow=True)]})


def backdrop(index):
    return switch('looks_switchbackdropto', 'BACKDROP', 'looks_backdrops', 'BACKDROP', BACKDROPS[index])


def costume(name):
    return switch('looks_switchcostumeto', 'COSTUME', 'looks_costume', 'COSTUME', name)


def flash(value):
    return block('event_broadcastandwait', {'BROADCAST_INPUT': [3, value, [11, 'rojo', 'rojo']]})


def controller():
    scripts = Scripts()
    random_index = block('operator_random', {'FROM': slot(1), 'TO': report(
        block('data_lengthoflist', fields={'LIST': ['Colores', 'Colores']}))})
    add_color = block('data_addtolist', {
        'ITEM': report(item('Colores', report(random_index)))
    }, {'LIST': ['Secuencia', 'Secuencia']})
    incorrect = block('operator_not', {'OPERAND': [2, equals(
        variable('Pulsación'), report(item('Secuencia', variable('Posición'))))]})
    stop = block('control_stop', fields={'STOP_OPTION': ['all', None]})
    stop['mutation'] = {'tagName': 'mutation', 'children': [], 'hasnext': 'false'}
    scripts.chain((
        block('event_whenflagclicked'),
        set_var('Turno', slot(0)),
        set_var('Rondas', slot(0)),
        set_var('Pulsación', slot('')),
        block('data_deletealloflist', fields={'LIST': ['Secuencia', 'Secuencia']}),
        block('control_forever', {'SUBSTACK': [2, (
            backdrop(1), add_color, wait(0.65),
            set_var('Posición', slot(1)),
            repeat((flash(item('Secuencia', variable('Posición'))), wait(0.18), increment('Posición'))),
            set_var('Posición', slot(1)),
            set_var('Pulsación', slot('')), backdrop(2), set_var('Turno', slot(1)),
            repeat((
                block('control_wait_until', {'CONDITION': [2, block('operator_not', {
                    'OPERAND': [2, equals(variable('Pulsación'), slot(''))]
                })]}),
                flash([12, 'Pulsación', 'Pulsación']),
                block('control_if', {'CONDITION': [2, incorrect], 'SUBSTACK': [2, (
                    set_var('Turno', slot(0)), backdrop(3), stop,
                )]}),
                block('control_if', {
                    'CONDITION': [2, block('operator_lt', {
                        'OPERAND1': variable('Posición'), 'OPERAND2': length(),
                    })],
                    'SUBSTACK': [2, (set_var('Pulsación', slot('')),)],
                }),
                increment('Posición'),
            )),
            set_var('Turno', slot(0)), increment('Rondas'),
        )]}),
    ), position=(40, 40))
    return scripts.blocks


def pad_scripts(name):
    scripts = Scripts()
    scripts.chain((block('event_whenflagclicked'), costume('reposo')), position=(40, 40))
    scripts.chain((
        block('event_whenbroadcastreceived', fields={'BROADCAST_OPTION': [name, name]}),
        costume('luz'),
        switch('sound_play', 'SOUND_MENU', 'sound_sounds_menu', 'SOUND_MENU', 'nota'),
        wait(0.42), costume('reposo'),
    ), position=(40, 170))
    can_play = block('operator_and', {
        'OPERAND1': [2, equals(variable('Turno'), slot(1))],
        'OPERAND2': [2, equals(variable('Pulsación'), slot(''))],
    })
    scripts.chain((
        block('event_whenthisspriteclicked'),
        block('control_if', {'CONDITION': [2, can_play], 'SUBSTACK': [2, (
            set_var('Pulsación', slot(name)),
        )]}),
    ), position=(360, 40))
    return scripts.blocks


def tone(frequency, rate, count):
    data = bytearray()
    for i in range(count):
        envelope = min(1, i / 100, (count - i) / 1200)
        sample = int(8500 * envelope * math.sin(2 * math.pi * frequency * i / rate))
        data.extend(struct.pack('<h', sample))
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as wav:
        wav.setparams((1, 2, rate, count, 'NONE', 'not compressed'))
        wav.writeframes(data)
    return buffer.getvalue()


def write_project(solution):
    assets = {}

    def asset(name, fmt, data, **metadata):
        digest = hashlib.md5(data).hexdigest()
        filename = f'{digest}.{fmt}'
        assets[filename] = data
        return dict(name=name, assetId=digest, md5ext=filename, dataFormat=fmt, **metadata)

    def image(name, width, height, content):
        return asset(name, 'svg', svg(width, height, content), bitmapResolution=1,
                     rotationCenterX=width / 2, rotationCenterY=height / 2)

    def target(name, stage, costumes, sounds, blocks, layer):
        return dict(name=name, isStage=stage, costumes=costumes, sounds=sounds,
                    blocks=blocks if solution else {}, layerOrder=layer, variables={}, lists={},
                    broadcasts={}, comments={}, currentCostume=0, volume=100)

    stage = target('Stage', True, [
        image(name, 480, 360, '<rect width="480" height="360" fill="#14263a"/>'
              + label(240, 33, 'Código de colores', '#fff', 24)
              + label(240, 72, name, '#dbeafe', 19))
        for name in BACKDROPS
    ], [], controller(), 0)
    stage.update(tempo=60, videoTransparency=50, videoState='off', textToSpeechLanguage=None)
    stage['variables'] = {name: [name, value] for name, value in VALUES.items()}
    stage['lists'] = {name: [name, items] for name, items in LISTS.items()}
    stage['broadcasts'] = {name: name for name, *_ in COLORS}
    targets = [stage]
    for index, (name, fill, light, frequency) in enumerate(COLORS):
        costumes = []
        for state, background, ink in [('reposo', fill, '#fff'), ('luz', light, '#111827')]:
            border = '#fff' if state == 'luz' else background
            costumes.append(image(state, 172, 91,
                f'<rect x="2" y="2" width="168" height="87" rx="14" fill="{background}" '
                f'stroke="{border}" stroke-width="4"/>' + label(86, 53, name.capitalize(), ink, 23)))
        rate, count = 22050, 5300
        sound = asset('nota', 'wav', tone(frequency, rate, count), rate=rate, sampleCount=count, format='')
        sprite = target(name.capitalize(), False, costumes, [sound], pad_scripts(name), index + 1)
        sprite.update(x=(-93, 93)[index % 2], y=(30, -72)[index // 2],
                      size=100, direction=90, visible=True, draggable=False, rotationStyle="don't rotate")
        targets.append(sprite)

    score = dict(id='Rondas', mode='default', opcode='data_variable', params={'VARIABLE': 'Rondas'},
                 spriteName=None, value=0, width=0, height=0, x=145, y=320, visible=True,
                 sliderMin=0, sliderMax=100, isDiscrete=True)
    project = dict(targets=targets, monitors=[score], extensions=[],
                   meta=dict(semver='3.0.0', vm='2.3.0', agent='PIAR'))
    filename = 'codigo-colores-solucion.sb3' if solution else 'codigo-colores-plantilla.sb3'
    with zipfile.ZipFile(OUT / filename, 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('project.json', json.dumps(project, ensure_ascii=False))
        for name, data in assets.items():
            archive.writestr(name, data)


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    write_project(False)
    write_project(True)
