'use client';

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { GraphData, GraphNode, GraphLink } from '@/app/types/spotify';

interface ForceGraphProps {
  data: GraphData;
  width?: number;
  height?: number;
  viewMode?: 'network' | 'hierarchical';
}

const ForceGraph: React.FC<ForceGraphProps> = ({ data, width = 1200, height = 800, viewMode = 'network' }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data.nodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Color scales for different node types
    const colorScale = {
      genre: '#FF10F0', // neon-pink
      artist: '#00FFF0', // neon-blue
      track: '#39FF14', // neon-green
    };

    // Create container for zoom
    const container = svg.append('g');

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Dynamic parameters based on node count
    const nodeCount = data.nodes.length;
    const isSmall = nodeCount <= 400;
    const isMedium = nodeCount <= 800;
    const isLarge = nodeCount <= 1200;
    
    // Adjust parameters based on size
    const linkDistance = isSmall ? 120 : isMedium ? 100 : isLarge ? 80 : 60;
    const genreLinkDistance = isSmall ? 150 : isMedium ? 130 : isLarge ? 100 : 80;
    const chargeStrength = isSmall ? -600 : isMedium ? -400 : isLarge ? -250 : -150;
    const genreChargeStrength = isSmall ? -800 : isMedium ? -600 : isLarge ? -400 : -250;
    const distanceMax = isSmall ? 500 : isMedium ? 400 : isLarge ? 300 : 200;
    const collisionPadding = isSmall ? 10 : isMedium ? 8 : isLarge ? 6 : 4;
    const alphaDecay = isSmall ? 0.02 : isMedium ? 0.03 : isLarge ? 0.04 : 0.05;
    const velocityDecay = isSmall ? 0.3 : isMedium ? 0.35 : isLarge ? 0.4 : 0.5;
    const linkOpacity = isSmall ? 0.2 : isMedium ? 0.15 : isLarge ? 0.1 : 0.05;
    const tickFrequency = isSmall ? 1 : isMedium ? 2 : isLarge ? 2 : 3;
    const minLabelRadius = isSmall ? 10 : isMedium ? 12 : isLarge ? 15 : 18;

    // Hierarchical positioning for y-axis
    const isHierarchical = viewMode === 'hierarchical';

    // Create force simulation with dynamic parameters
    const simulation = d3.forceSimulation<GraphNode>()
      .force('link', d3.forceLink<GraphNode, GraphLink>()
        .id((d) => d.id)
        .distance((d) => {
          const source = data.nodes.find(n => n.id === (d.source as any).id || n.id === d.source);
          const target = data.nodes.find(n => n.id === (d.target as any).id || n.id === d.target);
          
          if (isHierarchical) {
            // Radial distances for circular clustering
            if ((source?.group === 'genre' && target?.group === 'artist') ||
                (source?.group === 'artist' && target?.group === 'genre')) {
              return 160; // Increased from 120 for larger genre nodes
            }
            if ((source?.group === 'artist' && target?.group === 'track') ||
                (source?.group === 'track' && target?.group === 'artist')) {
              return 80; // Reduced from 100 for tighter track clustering
            }
            // Much longer distances for non-hierarchical connections
            return 300;
          }
          
          if (source?.group === 'genre' || target?.group === 'genre') {
            return genreLinkDistance / d.strength;
          }
          return linkDistance / d.strength;
        })
        .strength((d) => {
          if (isHierarchical) {
            const source = data.nodes.find(n => n.id === (d.source as any).id || n.id === d.source);
            const target = data.nodes.find(n => n.id === (d.target as any).id || n.id === d.target);
            
            // Strong attraction for parent-child relationships
            if ((source?.group === 'genre' && target?.group === 'artist') ||
                (source?.group === 'artist' && target?.group === 'genre')) {
              return 0.8;
            }
            if ((source?.group === 'artist' && target?.group === 'track') ||
                (source?.group === 'track' && target?.group === 'artist')) {
              return 0.6;
            }
            // Very weak for other connections
            return 0.05;
          }
          return d.strength * (isSmall ? 0.8 : isMedium ? 0.7 : 0.5);
        }))
      .force('charge', d3.forceManyBody<GraphNode>()
        .strength((d) => {
          if (isHierarchical) {
            // Different charge based on node type and size for circular layout
            if (d.group === 'genre') {
              const radius = 30 + (d.radius || 20) * 0.5;
              return -1200 - radius * 10; // Stronger repulsion for larger genre nodes
            }
            if (d.group === 'artist') {
              const radius = Math.max(15, Math.min(30, (d.popularity || 50) / 3.3));
              return -400 - radius * 5; // Medium repulsion
            }
            const radius = Math.max(8, Math.min(15, (d.popularity || 50) / 6.7));
            return -150 - radius * 3; // Light repulsion for small track nodes
          }
          
          if (d.group === 'genre') {
            return genreChargeStrength - (d.radius || 10) * 5;
          }
          return chargeStrength - (d.radius || 10) * 2;
        })
        .distanceMax(isHierarchical ? 600 : distanceMax))
      .force('collision', d3.forceCollide<GraphNode>()
        .radius((d) => {
          let radius;
          if (isHierarchical) {
            // Use the same radius calculation as the visual nodes
            if (d.group === 'genre') {
              radius = 30 + (d.radius || 20) * 0.5;
            } else if (d.group === 'artist') {
              radius = Math.max(15, Math.min(30, (d.popularity || 50) / 3.3));
            } else {
              radius = Math.max(8, Math.min(15, (d.popularity || 50) / 6.7));
            }
          } else {
            radius = d.radius || 10;
          }
          return radius + (isHierarchical ? collisionPadding * 0.7 : collisionPadding);
        })
        .strength(0.7)
        .iterations(isSmall ? 2 : 1))
      .alphaDecay(alphaDecay)
      .velocityDecay(velocityDecay);

    // Add center force for non-hierarchical view
    if (!isHierarchical) {
      simulation.force('center', d3.forceCenter(width / 2, height / 2));
    } else {
      // For hierarchical view, use radial positioning
      
      // First, find primary connections for clustering
      const nodeParents = new Map<string, string>();
      
      // Map artists to their primary genre (first genre)
      data.nodes.filter(n => n.group === 'artist').forEach(artist => {
        const genreLink = data.links.find(l => 
          (l.source === artist.id && data.nodes.find(n => n.id === l.target)?.group === 'genre') ||
          (l.target === artist.id && data.nodes.find(n => n.id === l.source)?.group === 'genre')
        );
        if (genreLink) {
          const genreId = genreLink.source === artist.id ? genreLink.target : genreLink.source;
          nodeParents.set(artist.id, genreId as string);
        }
      });
      
      // Map tracks to their primary artist (first artist)
      data.nodes.filter(n => n.group === 'track').forEach(track => {
        const artistLink = data.links.find(l => 
          (l.source === track.id && data.nodes.find(n => n.id === l.target)?.group === 'artist') ||
          (l.target === track.id && data.nodes.find(n => n.id === l.source)?.group === 'artist')
        );
        if (artistLink) {
          const artistId = artistLink.source === track.id ? artistLink.target : artistLink.source;
          nodeParents.set(track.id, artistId as string);
        }
      });
      
      // Position genres in a circle
      const genres = data.nodes.filter(n => n.group === 'genre');
      const genreCount = genres.length;
      const genreRadius = Math.min(width, height) * 0.3; // Increased from 0.25 to accommodate larger nodes
      
      // Custom positioning force
      const positionForce = (alpha: number) => {
        data.nodes.forEach((d: GraphNode) => {
          if (d.group === 'genre') {
            // Position genres in a circle
            const index = genres.findIndex(g => g.id === d.id);
            const angle = (index / genreCount) * 2 * Math.PI;
            const targetX = width / 2 + genreRadius * Math.cos(angle);
            const targetY = height / 2 + genreRadius * Math.sin(angle);
            
            d.vx = (d.vx || 0) + (targetX - (d.x || 0)) * alpha * 0.5;
            d.vy = (d.vy || 0) + (targetY - (d.y || 0)) * alpha * 0.5;
          } else if (d.group === 'artist') {
            // Position artists around their genre
            const parentId = nodeParents.get(d.id);
            if (parentId) {
              const parent = data.nodes.find(n => n.id === parentId);
              if (parent && parent.x !== undefined && parent.y !== undefined) {
                const dx = (d.x || 0) - parent.x;
                const dy = (d.y || 0) - parent.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                // Increased distance to account for larger genre nodes
                const targetDistance = 140;
                
                if (distance > 0) {
                  const factor = (targetDistance - distance) / distance * alpha * 0.3;
                  d.vx = (d.vx || 0) + dx * factor;
                  d.vy = (d.vy || 0) + dy * factor;
                }
              }
            }
          } else if (d.group === 'track') {
            // Position tracks around their artist
            const parentId = nodeParents.get(d.id);
            if (parentId) {
              const parent = data.nodes.find(n => n.id === parentId);
              if (parent && parent.x !== undefined && parent.y !== undefined) {
                const dx = (d.x || 0) - parent.x;
                const dy = (d.y || 0) - parent.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                // Adjusted distance for medium artist nodes
                const targetDistance = 70;
                
                if (distance > 0) {
                  const factor = (targetDistance - distance) / distance * alpha * 0.3;
                  d.vx = (d.vx || 0) + dx * factor;
                  d.vy = (d.vy || 0) + dy * factor;
                }
              }
            }
          }
        });
      };
      
      simulation.force('position', positionForce as any);
      
      // Add a gentle centering force
      simulation.force('center', d3.forceCenter(width / 2, height / 2).strength(0.02));
    }

    // Create links with dynamic opacity
    const link = container.append('g')
      .selectAll('line')
      .data(data.links)
      .enter().append('line')
      .attr('stroke', '#ffffff')
      .attr('stroke-opacity', linkOpacity)
      .attr('stroke-width', (d) => d.strength * (isSmall ? 1.5 : 1));

    // Create node groups
    const node = container.append('g')
      .selectAll('g')
      .data(data.nodes)
      .enter().append('g')
      .call(d3.drag<SVGGElement, GraphNode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Add circles to nodes with standard styling
    node.append('circle')
      .attr('r', (d) => {
        if (isHierarchical) {
          // Hierarchical view: genres largest, artists medium, tracks smallest
          if (d.group === 'genre') {
            // Genres: 30-50 radius
            return 30 + (d.radius || 20) * 0.5;
          } else if (d.group === 'artist') {
            // Artists: 15-30 radius based on popularity
            return Math.max(15, Math.min(30, (d.popularity || 50) / 3.3));
          } else {
            // Tracks: 8-15 radius based on popularity
            return Math.max(8, Math.min(15, (d.popularity || 50) / 6.7));
          }
        }
        return d.radius || 10;
      })
      .attr('fill', (d) => colorScale[d.group])
      .attr('stroke', (d) => colorScale[d.group])
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.8)
      .style('filter', 'url(#glow)');

    // Add labels with dynamic visibility
    node.append('text')
      .text((d) => d.name)
      .attr('x', 0)
      .attr('y', (d) => {
        // Calculate radius based on view mode
        let radius;
        if (isHierarchical) {
          if (d.group === 'genre') {
            radius = 30 + (d.radius || 20) * 0.5;
          } else if (d.group === 'artist') {
            radius = Math.max(15, Math.min(30, (d.popularity || 50) / 3.3));
          } else {
            radius = Math.max(8, Math.min(15, (d.popularity || 50) / 6.7));
          }
        } else {
          radius = d.radius || 10;
        }
        return radius + 15;
      })
      .attr('text-anchor', 'middle')
      .attr('fill', '#ffffff')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .style('text-shadow', '0 0 10px rgba(255, 255, 255, 0.5)')
      .style('display', (d) => {
        // Dynamic label hiding based on node count
        if (d.group === 'track' && (d.radius || 10) < minLabelRadius) {
          return 'none';
        }
        if (d.group === 'artist' && (d.radius || 10) < minLabelRadius + 5) {
          return 'none';
        }
        return 'block';
      });

    // Add glow filter
    const defs = svg.append('defs');
    
    const filter = defs.append('filter')
      .attr('id', 'glow');
    
    filter.append('feGaussianBlur')
      .attr('stdDeviation', '4')
      .attr('result', 'coloredBlur');
    
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode')
      .attr('in', 'coloredBlur');
    feMerge.append('feMergeNode')
      .attr('in', 'SourceGraphic');

    // Add tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'tooltip')
      .style('position', 'absolute')
      .style('padding', '10px')
      .style('background', 'rgba(0, 0, 0, 0.8)')
      .style('border', '1px solid currentColor')
      .style('border-radius', '5px')
      .style('color', '#ffffff')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('z-index', 1000);

    // Function to find upstream nodes (parent nodes in hierarchy)
    const findUpstreamNodes = (nodeId: string): Set<string> => {
      const upstream = new Set<string>();
      const toProcess = [nodeId];
      
      while (toProcess.length > 0) {
        const currentId = toProcess.pop()!;
        
        // Find all links where this node is the target (downstream)
        data.links.forEach(link => {
          const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id;
          const targetId = typeof link.target === 'string' ? link.target : (link.target as any).id;
          
          if (targetId === currentId && !upstream.has(sourceId)) {
            upstream.add(sourceId);
            toProcess.push(sourceId);
          }
        });
      }
      
      return upstream;
    };

    // Function to find upstream links
    const findUpstreamLinks = (nodeId: string, upstreamNodes: Set<string>): Set<string> => {
      const upstreamLinks = new Set<string>();
      const allRelevantNodes = new Set([nodeId, ...Array.from(upstreamNodes)]);
      
      data.links.forEach((link, index) => {
        const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id;
        const targetId = typeof link.target === 'string' ? link.target : (link.target as any).id;
        
        // Include link if it connects nodes in the upstream path
        if (allRelevantNodes.has(sourceId) && allRelevantNodes.has(targetId)) {
          upstreamLinks.add(index.toString());
        }
      });
      
      return upstreamLinks;
    };

    // Add hover interaction with improved event handling
    let hoverTimeout: number | null = null;
    let currentHoveredNode: string | null = null;

    const applyHighlighting = (d: GraphNode) => {
      if (currentHoveredNode === d.id) return; // Already highlighting this node
      currentHoveredNode = d.id;

      // Find upstream nodes and links
      const upstreamNodes = findUpstreamNodes(d.id);
      const upstreamLinks = findUpstreamLinks(d.id, upstreamNodes);
      
      // Highlight the hovered node and upstream nodes
      node.selectAll('circle')
        .attr('stroke-width', (nodeData: any) => {
          if (nodeData.id === d.id) return 4; // Hovered node gets thicker border
          if (upstreamNodes.has(nodeData.id)) return 3; // Upstream nodes get medium border
          return 2; // Others keep normal border
        })
        .attr('stroke-opacity', (nodeData: any) => {
          if (nodeData.id === d.id || upstreamNodes.has(nodeData.id)) return 1;
          return 0.3; // Dim non-related nodes
        })
        .attr('fill-opacity', (nodeData: any) => {
          if (nodeData.id === d.id || upstreamNodes.has(nodeData.id)) return 1;
          return 0.3; // Dim non-related nodes
        });

      // Highlight upstream links
      link.attr('stroke-opacity', (linkData: any, i: number) => {
        if (upstreamLinks.has(i.toString())) return 0.8; // Highlight upstream links
        return 0.1; // Dim other links
      })
      .attr('stroke-width', (linkData: any, i: number) => {
        if (upstreamLinks.has(i.toString())) {
          return (linkData.strength * (isSmall ? 1.5 : 1)) * 1.5; // Thicker upstream links
        }
        return linkData.strength * (isSmall ? 1.5 : 1);
      });

      // Highlight upstream text labels
      node.selectAll('text')
        .attr('opacity', (nodeData: any) => {
          if (nodeData.id === d.id || upstreamNodes.has(nodeData.id)) return 1;
          return 0.3; // Dim non-related labels
        })
        .attr('font-weight', (nodeData: any) => {
          if (nodeData.id === d.id || upstreamNodes.has(nodeData.id)) return 'bold';
          return 'normal';
        });

      // Show enhanced tooltip with upstream information
      const upstreamInfo = Array.from(upstreamNodes)
        .map(nodeId => data.nodes.find(n => n.id === nodeId))
        .filter(Boolean)
        .map(n => n!.name)
        .join(' → ');

      tooltip.transition()
        .duration(200)
        .style('opacity', .9);
      
      tooltip.html(`
        <div style="color: ${colorScale[d.group]}">
          <strong>${d.name}</strong><br/>
          ${d.group === 'track' || d.group === 'artist' ? `Popularity: ${d.popularity}<br/>` : ''}
          ${upstreamInfo ? `Path: ${upstreamInfo} → <strong>${d.name}</strong>` : ''}
        </div>
      `);
    };

    const resetHighlighting = () => {
      currentHoveredNode = null;
      
      // Reset all visual enhancements
      node.selectAll('circle')
        .attr('stroke-width', 2)
        .attr('stroke-opacity', 0.8)
        .attr('fill-opacity', 1);

      link.attr('stroke-opacity', linkOpacity)
        .attr('stroke-width', (d) => d.strength * (isSmall ? 1.5 : 1));

      node.selectAll('text')
        .attr('opacity', (d: any) => {
          // Restore original visibility logic
          if (d.group === 'track' && (d.radius || 10) < minLabelRadius) {
            return 0;
          }
          if (d.group === 'artist' && (d.radius || 10) < minLabelRadius + 5) {
            return 0;
          }
          return 1;
        })
        .attr('font-weight', 'bold');

      tooltip.transition()
        .duration(300)
        .style('opacity', 0);
    };

    node
      .on('mouseenter', (event, d) => {
        // Clear any existing timeout
        if (hoverTimeout) {
          clearTimeout(hoverTimeout);
          hoverTimeout = null;
        }
        
        // Apply highlighting immediately
        applyHighlighting(d);
        
        // Update tooltip position
        tooltip
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px')
          .style('border-color', colorScale[d.group]);
      })
      .on('mousemove', (event, d) => {
        // Update tooltip position on mouse move
        if (currentHoveredNode === d.id) {
          tooltip
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 28) + 'px');
        }
      })
      .on('mouseleave', (event, d) => {
        // Add a small delay before resetting to prevent flickering
        hoverTimeout = setTimeout(() => {
          resetHighlighting();
        }, 100);
      })
    .on('click', (event, d) => {
      if (d.spotifyUrl) {
        window.open(d.spotifyUrl, '_blank');
      }
    });

    // Set simulation nodes and links
    simulation.nodes(data.nodes);
    (simulation.force('link') as d3.ForceLink<GraphNode, GraphLink>).links(data.links);

    // Update positions on tick with dynamic frequency
    let tickCount = 0;
    simulation.on('tick', () => {
      tickCount++;
      
      // Update less frequently for better performance with many nodes
      if (tickCount % tickFrequency === 0) {
        link
          .attr('x1', (d: any) => d.source.x)
          .attr('y1', (d: any) => d.source.y)
          .attr('x2', (d: any) => d.target.x)
          .attr('y2', (d: any) => d.target.y);

        node
          .attr('transform', (d) => `translate(${d.x},${d.y})`);
      }
    });

    // Drag functions
    function dragstarted(event: any, d: GraphNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: GraphNode) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: GraphNode) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // Cleanup
    return () => {
      simulation.stop();
      tooltip.remove();
    };
  }, [data, width, height, viewMode]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className="graph-container"
      style={{ cursor: 'grab' }}
    />
  );
};

export default ForceGraph; 