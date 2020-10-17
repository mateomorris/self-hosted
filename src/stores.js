import {writable,readable} from 'svelte/store'

export const user = writable({
  signedIn: false
})

export const server = readable(window.location.origin)