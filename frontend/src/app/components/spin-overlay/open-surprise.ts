import { ViewContainerRef } from '@angular/core';
import { RecipeModel } from '../../models/recipe-model';

/**
 * Opens the "Surprise me" dialog. The wheel is a lazy chunk: nothing of it is
 * downloaded until someone asks for a surprise.
 */
export async function openSurprise(host: ViewContainerRef, recipes: RecipeModel[]): Promise<void> {
  const { SpinOverlay } = await import('./spin-overlay');
  const ref = host.createComponent(SpinOverlay);
  ref.setInput('recipes', recipes);
  ref.instance.closed.subscribe(() => ref.destroy());
}
