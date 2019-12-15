#ifdef GL_ES
precision mediump float;
#endif

#define MAX_NUM_METABALLS 2
#define THRESHOLD 0.424
#define RADIUS 0.065

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

uniform vec2 u_metaball_pos[MAX_NUM_METABALLS];
uniform float u_metaball_radius[MAX_NUM_METABALLS];
uniform int u_num_metaballs;
uniform float u_threshold;

vec4 grayscale(float value) {
    return vec4(vec3(value), 1.);
}

vec4 color_for_density(float density) {
    if (density > u_threshold) {
        return grayscale(0.0);
    }
    return grayscale(0.95);
}

void main() {
    vec2 frag_pos = gl_FragCoord.xy / u_resolution;

    float density = 0.;
    for (int i = 0; i < MAX_NUM_METABALLS; i++) {
        if (i >= u_num_metaballs) {
          continue;
        }
        vec2 pos = u_metaball_pos[i] / u_resolution;
        float single_ball_density =
          (u_metaball_radius[i] * u_metaball_radius[i])
          / dot((frag_pos - pos), (frag_pos - pos));
        density += single_ball_density;
    }
    
    
    gl_FragColor = color_for_density(density);
}
