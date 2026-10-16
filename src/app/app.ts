import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router'; // <-- Must be imported

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],                     // <-- Must be included here
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}